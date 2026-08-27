from PIL import Image
import os

def crop_sheet(path, cols, rows, ignore_top=0, out_prefix="", out_dir="game_assets/cropped"):
    os.makedirs(out_dir, exist_ok=True)
    img = Image.open(path).convert("RGBA")
    W,H = img.size
    offset_y = int(H * ignore_top)
    usable_h = H - offset_y
    img_cropped_top = img.crop((0, offset_y, W, H))
    W,H = img_cropped_top.size
    fw = W // cols
    fh = H // rows
    saved = []
    idx=0
    for r in range(rows):
        for c in range(cols):
            x0 = c*fw
            y0 = r*fh
            x1 = x0+fw
            y1 = y0+fh
            cell = img_cropped_top.crop((x0,y0,x1,y1))
            # Make near-white transparent + remove light grey grid
            datas = cell.getdata()
            new_data = []
            for item in datas:
                r_,g_,b_,a = item
                # white background
                if r_>225 and g_>225 and b_>225:
                    new_data.append((255,255,255,0))
                # light grey grid lines from asteroids sheet (200-240 grey)
                elif r_>190 and g_>190 and b_>190 and abs(r_-g_)<12 and abs(g_-b_)<12 and r_>210:
                    # keep darker asteroid shading, remove very light grey
                    if r_>235 or (r_>220 and a<255):
                        new_data.append((255,255,255,0))
                    else:
                        new_data.append(item)
                # also pure black grid lines in effects sheet - keep black outline! So don't remove black
                else:
                    new_data.append(item)
            cell.putdata(new_data)
            # tight crop to non-transparent bbox
            bbox = cell.getbbox()
            if bbox:
                # add padding
                pad=6
                x0b,y0b,x1b,y1b = bbox
                x0b = max(0, x0b-pad)
                y0b = max(0, y0b-pad)
                x1b = min(cell.width, x1b+pad)
                y1b = min(cell.height, y1b+pad)
                cell = cell.crop((x0b,y0b,x1b,y1b))
                out_path = f"{out_dir}/{out_prefix}_{idx}.png"
                cell.save(out_path)
                saved.append(out_path)
                idx+=1
    print(f"{out_prefix}: saved {len(saved)} -> {saved}")
    return saved

# Process all
crop_sheet("game_assets/player_ship_sheet.png", 4,1, 0, "player")
crop_sheet("game_assets/powerups_sheet.png", 3,1, 0, "powerup")
crop_sheet("game_assets/asteroids_sheet.png", 2,2, 0, "asteroid")
crop_sheet("game_assets/enemies_sheet.png", 3,1, 0, "enemy")
crop_sheet("game_assets/effects_sheet.png", 6,1, 0, "effect")
crop_sheet("game_assets/potato_float_sheet.png", 3,1, 0.22, "potato_float")
crop_sheet("game_assets/ui_icons_sheet.png", 2,2, 0, "ui")

# Also create a combined sprite sheet preview for verification
from PIL import Image
import glob
files = glob.glob("game_assets/cropped/*.png")
print(f"Total cropped files: {len(files)}")
for f in files:
    im=Image.open(f)
    print(f, im.size)
