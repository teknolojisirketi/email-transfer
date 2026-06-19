import imaplib
from dataclasses import dataclass


@dataclass
class ImapTestResult:
    success: bool
    message: str
    folder_count: int = 0
    inbox_messages: int = 0


def test_imap_connection(
    host: str,
    port: int,
    email: str,
    password: str,
    use_ssl: bool = True,
    timeout: int = 30,
) -> ImapTestResult:
    host = host.strip()
    email = email.strip()
    imap = None

    try:
        if use_ssl:
            imap = imaplib.IMAP4_SSL(host, port, timeout=timeout)
        else:
            imap = imaplib.IMAP4(host, port, timeout=timeout)

        imap.login(email, password)

        status, folders = imap.list()
        folder_count = len(folders) if status == "OK" and folders else 0

        inbox_messages = 0
        status, data = imap.select("INBOX", readonly=True)
        if status == "OK" and data and data[0]:
            inbox_messages = int(data[0])

        imap.logout()
        return ImapTestResult(
            success=True,
            message="Bağlantı başarılı",
            folder_count=folder_count,
            inbox_messages=inbox_messages,
        )
    except imaplib.IMAP4.error as exc:
        return ImapTestResult(success=False, message=f"IMAP hatası: {exc}")
    except OSError as exc:
        return ImapTestResult(success=False, message=f"Bağlantı hatası: {exc}")
    except Exception as exc:
        return ImapTestResult(success=False, message=str(exc))
    finally:
        if imap is not None:
            try:
                imap.shutdown()
            except Exception:
                pass
