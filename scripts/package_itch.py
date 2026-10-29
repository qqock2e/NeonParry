"""Build the self-contained itch.io upload with index.html at the ZIP root."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
output = root / 'dist' / 'NeonParry-itch.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    archive.write(root / 'index.html', 'index.html')
print(output)
