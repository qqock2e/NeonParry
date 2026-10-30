"""Package the browser renderer, with index.html at the ZIP root."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
renderer = root / 'src' / 'renderer'
output = root / 'dist' / 'NeonParry-itch.zip'
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', compression=ZIP_DEFLATED) as archive:
    for asset in sorted(renderer.rglob('*')):
        if asset.is_file():
            archive.write(asset, asset.relative_to(renderer).as_posix())
print(output)
