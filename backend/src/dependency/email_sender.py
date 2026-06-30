import smtplib
import os
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

SENDER   = "elysium.server.home@gmail.com"
PASSWORD = "bzdzqhdxxlyydkun"

RECIPIENTS = [
    "kc.dev.py@gmail.com",
    "rishabthapa7777@gmail.com",
    "ishannepal00001@gmail.com"
    ]

SUBJECT = "INVOICELY · arcademia.app Merch Purchase · June 2026"
FROM_NAME = "ELYSIUM via INVOICELY"

HTML_FILE = Path(__file__).parent.parent /"ui"/ "merch.html"

# ── Validation ────────────────────────────────────────────────────────────────

def validate():
    errors = []
    if not SENDER:
        errors.append("GMAIL_USER not set in .env")
    if not PASSWORD:
        errors.append("GMAIL_PASS not set in .env")
    if not HTML_FILE.exists():
        errors.append(f"HTML file not found: {HTML_FILE}")
    if not RECIPIENTS:
        errors.append("RECIPIENTS list is empty")
    if errors:
        for e in errors:
            print(f"[ERROR] {e}")
        sys.exit(1)

# ── Build message ─────────────────────────────────────────────────────────────

def build_message(recipient: str) -> MIMEMultipart:
    html = HTML_FILE.read_text(encoding="utf-8")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = SUBJECT
    msg["From"]    = f"{FROM_NAME} <{SENDER}>"
    msg["To"]      = recipient

    # Plain text fallback for clients that don't render HTML


    # msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html,  "html"))   # HTML must be last (highest priority)

    return msg

# ── Send ──────────────────────────────────────────────────────────────────────

def send():
    validate()

    print(f"[ELYSIUM] Connecting to {SMTP_HOST}:{SMTP_PORT} ...")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(SENDER, PASSWORD)
            print(f"[ELYSIUM] Logged in as {SENDER}")

            for recipient in RECIPIENTS:
                msg = build_message(recipient)
                smtp.sendmail(SENDER, recipient, msg.as_string())
                print(f"[ELYSIUM] ✓ Sent to {recipient}")

    except smtplib.SMTPAuthenticationError:
        print("[ERROR] Auth failed — check your App Password in .env")
        print("        Generate one at: myaccount.google.com → Security → App Passwords")
        sys.exit(1)
    except smtplib.SMTPConnectError:
        print("[ERROR] Could not connect to Gmail SMTP. Check your internet.")
        sys.exit(1)
    except smtplib.SMTPException as e:
        print(f"[ERROR] SMTP error: {e}")
        sys.exit(1)
    except TimeoutError:
        print("[ERROR] Connection timed out.")
        sys.exit(1)

    print(f"\n[ELYSIUM] Done. {len(RECIPIENTS)} email(s) dispatched.")

# ── Entry ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    send()
