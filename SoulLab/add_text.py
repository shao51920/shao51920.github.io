import sys
from PIL import Image, ImageDraw, ImageFont

def add_text_to_image(img_path, output_path, text):
    try:
        img = Image.open(img_path)
    except Exception as e:
        print(f"Failed to open image: {e}")
        return
        
    draw = ImageDraw.Draw(img)
    width, height = img.size
    
    # Try common Windows Chinese fonts
    font_paths = [
        "C:\\Windows\\Fonts\\msyh.ttc",    # Microsoft YaHei
        "C:\\Windows\\Fonts\\msyhbd.ttc",  # Microsoft YaHei Bold
        "C:\\Windows\\Fonts\\simhei.ttf",  # SimHei
    ]
    
    font = None
    for fp in font_paths:
        try:
            # font size proportional to image height
            font_size = int(height * 0.08)
            font = ImageFont.truetype(fp, font_size)
            break
        except:
            continue
            
    if font is None:
        print("Could not load a valid Chinese font. Please check font paths.")
        return

    # Calculate text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Position: Bottom center, slightly up
    x = (width - text_width) / 2
    y = height - text_height - (height * 0.1)  # 10% from bottom
    
    # Draw outline/shadow for visibility
    shadow_color = "black"
    text_color = "white"
    outline_width = max(2, int(height * 0.005))
    
    # Draw outline
    for adj_x in range(-outline_width, outline_width+1):
        for adj_y in range(-outline_width, outline_width+1):
            if adj_x == 0 and adj_y == 0:
                continue
            draw.text((x + adj_x, y + adj_y), text, font=font, fill=shadow_color)
            
    # Draw main text
    draw.text((x, y), text, font=font, fill=text_color)
    
    img.save(output_path)
    print(f"Successfully saved image to {output_path}")

if __name__ == "__main__":
    add_text_to_image("images/crash.png", "images/crash.png", "绝望坠落者")
