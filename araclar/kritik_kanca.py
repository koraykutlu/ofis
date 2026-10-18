"""Tam yetenek kipinin kritik iş kilidi: claude'un PreToolUse kancası (ofis.pyw > sor, --settings ile verilir).

Kritik işler (silme, git push/reset/config, ağa çıkan komutlar, satır içi kod çalıştırma, vault dışına yazma) kullanıcı ofiste
"Emin misin?" penceresinde onaylamadan çalışmaz: kanca aracı reddeder, isteği VERI/kritik.json > bekleyen'e yazar; ofis sohbet bitince
pencereyi gösterir. Onaylanan iş (aynı araç + birebir aynı komut/yol) 10 dk içinde BİR KEZ geçer.
Ortam: OFIS_KRITIK (kritik.json yolu), OFIS_VAULT, OFIS_KOSU (bu sohbet çağrısının kimliği). En iyi çaba kilidi: modelin kazara ya da dosyadaki
gizli talimatla kritik iş yapmasını durdurur; kötü niyetli bir yazılıma karşı korumaz (ör. yazdığı betiği çalıştırması).
"""
import hashlib
import json
import os
import re
import secrets
import sys
import time
from pathlib import Path

ONAY_SURE, BEKLEME_SURE = 600, 1800
SIL = {"rm", "rmdir", "del", "erase", "rd", "unlink", "shred", "remove-item", "ri", "clear-content", "clc", "clear-recyclebin"}
AG = {"curl", "wget", "invoke-webrequest", "invoke-restmethod", "iwr", "irm", "scp", "sftp", "ftp", "ssh", "rsync", "nc", "ncat", "telnet",
      "send-mailmessage", "start-bitstransfer", "bitsadmin", "certutil"}
SISTEM = {"format", "shutdown", "reg", "schtasks", "sc", "bcdedit", "diskpart", "takeown", "icacls", "setx", "set-executionpolicy",
          "stop-computer", "restart-computer", "taskkill", "stop-process", "kill", "chmod", "chown", "runas"}
YORUMLAYICI = {"python", "python3", "py", "pythonw", "node", "powershell", "pwsh", "cmd", "bash", "sh", "wsl", "deno", "ruby", "perl"}
GIT_KRITIK = {"push", "reset", "clean", "rebase", "config", "filter-branch", "filter-repo", "update-ref", "gc", "prune", "rm"}
GH_KRITIK = {"pr", "issue", "release", "repo", "api", "gist", "secret", "workflow", "auth", "ssh-key", "gpg-key", "variable", "label"}


def bolumler(komut):
    """Komutu ; && || | ve satır sonlarından, $( ) ve ` ` içlerinden parçalar; her parçanın kelimeleri (küçük harf)."""
    ic = re.findall(r"\$\(([^()]*)\)|`([^`]*)`", komut)
    parcalar = re.split(r"&&|\|\||[;|\n&]", komut) + [a or b for a, b in ic]
    for p in parcalar:
        p = re.sub(r"^[\s({]+", "", p)
        kelime = re.findall(r"""'[^']*'|"[^"]*"|\S+""", p)
        while kelime and re.fullmatch(r"\w+=\S*|sudo|env|exec|command|time|nohup|xargs|&|start", kelime[0], re.I):   # önekler
            kelime = kelime[1:]
        if kelime:
            yield [k.strip("'\"").lower() for k in kelime]


def komut_neden(komut):
    """Kritikse kısa Türkçe neden, değilse None."""
    if re.search(r"(^|\s)-delete\b|\bxargs\s+(rm|del)\b", komut, re.I):
        return "dosya silme"
    for k in bolumler(komut):
        ad = re.sub(r"\.(exe|cmd|bat|com)$", "", k[0].replace("\\", "/").rsplit("/", 1)[-1])
        ikinci = next((x for x in k[1:] if not x.startswith("-")), "")
        if ad in SIL:
            return "dosya silme"
        if ad in AG:
            return "ağa bağlanma / dışarıya gönderme"
        if ad in SISTEM:
            return "sistem ayarı ya da süreç değiştirme"
        if ad in ("mv", "move", "move-item", "ren", "rename", "rename-item") and any(x in ("-f", "-force", "/y") for x in k[1:]):
            return "üzerine yazarak taşıma"
        if ad == "git":
            if ikinci in GIT_KRITIK or (ikinci == "branch" and any(x in ("-d", "--delete", "-m", "-f") for x in k[2:])) \
                    or (ikinci in ("checkout", "restore", "switch") and any(x in ("--", ".", "-f", "--force", "--discard-changes") for x in k[2:])) \
                    or (ikinci == "stash" and any(x in ("drop", "clear") for x in k[2:])) or (ikinci == "commit" and "--amend" in k):
                return f"git {ikinci} (geri alınamaz ya da dışarıya giden git işlemi)"
        if ad == "gh" and ikinci in GH_KRITIK:
            ucuncu = next((x for x in k[k.index(ikinci) + 1:] if not x.startswith("-")), "")
            okur = ikinci == "api" and not any(x in ("-x", "--method", "-f", "--field", "--raw-field", "--input") for x in k)
            if not okur and not (ikinci != "api" and ucuncu in ("view", "list", "status", "diff", "checks")):
                return f"GitHub'a yazma (gh {ikinci})"
        if ad in ("npm", "pnpm", "yarn", "twine", "cargo", "dotnet") and ikinci in ("publish", "upload", "push"):
            return "paket yayınlama"
        if ad in ("npm", "pnpm", "yarn", "pip", "pip3", "winget", "choco", "scoop") and ikinci in ("install", "uninstall", "remove", "add", "i"):
            return "program kurma / kaldırma"
        if ad in YORUMLAYICI and any(x in ("-c", "-e", "/c", "/k", "-command", "-encodedcommand", "-enc", "--eval") for x in k[1:]):
            return "satır içi kod çalıştırma (içinde ne olduğu denetlenemez)"
    return None


def vault_disinda(yol, vault):
    try:
        Path(yol).resolve().relative_to(Path(vault).resolve())
        return False
    except (ValueError, OSError):
        return True


def incele(veri, vault):
    """(araç, iş metni, neden) ya da None."""
    arac, girdi = veri.get("tool_name", ""), veri.get("tool_input") or {}
    if arac in ("Bash", "PowerShell"):
        komut = str(girdi.get("command") or "")
        neden = komut_neden(komut)
        return (arac, komut, neden) if neden else None
    if arac in ("Write", "Edit", "MultiEdit", "NotebookEdit"):
        yol = str(girdi.get("file_path") or girdi.get("notebook_path") or "")
        if not vault or vault_disinda(yol, vault):
            return (arac, yol, "vault dışına yazma")
    return None


def oku(dosya):
    try:
        d = json.loads(dosya.read_text(encoding="utf-8"))
        return {"onayli": dict(d.get("onayli") or {}), "bekleyen": dict(d.get("bekleyen") or {})}
    except (OSError, ValueError, AttributeError):
        return {"onayli": {}, "bekleyen": {}}


def yaz(dosya, d):
    gec = dosya.with_name(dosya.name + ".tmp")
    gec.write_text(json.dumps(d, ensure_ascii=False), encoding="utf-8")
    os.replace(gec, dosya)


def ozet(arac, is_metni):
    return hashlib.sha256(f"{arac}\x00{is_metni}".encode("utf-8")).hexdigest()


def karar(ret, neden=""):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny" if ret else "allow",
                                             "permissionDecisionReason": neden}}, ensure_ascii=False))


def main():
    try:
        veri = json.loads(sys.stdin.buffer.read().decode("utf-8", "replace") or "{}")
    except ValueError:
        return karar(True, "KRİTİK İŞ KİLİDİ: araç girdisi okunamadı.")
    dosya = Path(os.environ.get("OFIS_KRITIK", ""))
    if not os.environ.get("OFIS_KRITIK"):
        return karar(True, "KRİTİK İŞ KİLİDİ: ofis kilidi yapılandırılmamış.")
    bulgu = incele(veri, os.environ.get("OFIS_VAULT", ""))
    if not bulgu:
        return   # kritik değil: normal izinler geçerli
    arac, is_metni, neden = bulgu
    h, simdi = ozet(arac, is_metni), time.time()
    d = oku(dosya)
    d["onayli"] = {k: t for k, t in d["onayli"].items() if simdi - t < ONAY_SURE}
    d["bekleyen"] = {k: v for k, v in d["bekleyen"].items() if simdi - v.get("zaman", 0) < BEKLEME_SURE}
    if h in d["onayli"]:
        del d["onayli"][h]   # tek kullanımlık
        yaz(dosya, d)
        return karar(False, "Kullanıcı ofisteki 'Emin misin?' penceresinde onayladı.")
    jeton = next((j for j, v in d["bekleyen"].items() if v.get("ozet") == h), None) or secrets.token_urlsafe(12)
    d["bekleyen"][jeton] = {"ozet": h, "arac": arac, "is": is_metni[:2000], "neden": neden, "kosu": os.environ.get("OFIS_KOSU", ""), "zaman": simdi}
    yaz(dosya, d)
    karar(True, f"KRİTİK İŞ KİLİDİ ({neden}): bu iş kullanıcının ofisteki 'Emin misin?' penceresinde onayını bekliyor ve ŞİMDİ ÇALIŞMADI. "
                "Başka bir komutla, betikle ya da yoldan aynı sonuca ulaşmaya ÇALIŞMA. Kullanıcıya ne yapmak istediğini ve neden kritik olduğunu "
                "tek iki cümleyle söyle, onay penceresinin açıldığını belirt ve dur. Onay gelirse sana haber verilecek; o zaman aynı işi birebir aynı haliyle tekrar dene.")


if __name__ == "__main__":
    main()
