"""Certificat auto-signé provisoire (1 jour) pour démarrer nginx avant Let's Encrypt.
Exécuté dans le conteneur certbot, qui embarque la bibliothèque cryptography."""
import datetime
import os
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

live = sys.argv[1]
os.makedirs(live, exist_ok=True)
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
now = datetime.datetime.now(datetime.timezone.utc)
cert = (
    x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key())
    .serial_number(x509.random_serial_number()).not_valid_before(now)
    .not_valid_after(now + datetime.timedelta(days=1)).sign(key, hashes.SHA256())
)
with open(os.path.join(live, "privkey.pem"), "wb") as f:
    f.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.TraditionalOpenSSL,
                              serialization.NoEncryption()))
with open(os.path.join(live, "fullchain.pem"), "wb") as f:
    f.write(cert.public_bytes(serialization.Encoding.PEM))
print(f"certificat provisoire écrit dans {live}")
