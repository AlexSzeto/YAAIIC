# Tag Search Bug Fix

## Goals
Discover and fix the cause of the tag search bug:
```
curl ^"http://localhost:3000/media-data?tags=anime^&query=^&limit=320^&folder=^" ^
  -H ^"sec-ch-ua-platform: ^\^"Windows^\^"^" ^
  -H ^"Referer: http://localhost:3000/^" ^
  -H ^"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36^" ^
  -H ^"sec-ch-ua: ^\^"Google Chrome^\^";v=^\^"143^\^", ^\^"Chromium^\^";v=^\^"143^\^", ^\^"Not A(Brand^\^";v=^\^"24^\^"^" ^
  -H ^"DNT: 1^" ^
  -H ^"sec-ch-ua-mobile: ?0^"
```

This search yields only one result, but should include at least this entry with the correct text "anime" in the tags.
```
    {
      "prompt": "purple hair, golden eyes, mage robe, mage hat, dark clothing, elaborate clothing, staff, crescent moon, dark forest ",
      "seed": 412379907,
      "imageUrl": "/media/image_306.png",
      "name": "Mina",
      "description": "The image depicts an illustrated character standing in front of a full moon that casts a soft glow on the scene. The character is a young woman with dark hair and striking purple eyes. She has fair skin and appears to be of human descent. Dressed in a medieval-style witch costume, she wears a long purple robe with gold accents and intricate patterns. A matching witch hat adorns her head, adding to the magical theme. In her right hand, she holds a wand that seems to emanate a gentle light, casting an enchanting aura around her. The background features a forested area with bare trees silhouetted against the dark sky. The overall atmosphere is one of mystique and magic, with a sense of tranquility and solitude.",
      "workflow": "Text to Image (Illustrious Characters)",
      "inpaint": false,
      "inpaintArea": null,
      "timeTaken": 20,
      "timestamp": "2025-12-22T05:12:35.317Z",
      "uid": 1766380355317,
      "tags": "witch, anime, purple, gold, moon, staff, frown, crescent, robe, cloak, tree, night, portrait",
      "savePath": "F:\\YAAIIC\\server\\storage\\image_306.png",
      "summary": "A young female character stands centered in the image. She has long, straight, dark purple hair falling to her waist, partially obscuring her face. Her eyes are golden-yellow, large, and almond-shaped. Her facial expression is neutral with a slight frown, and her mouth is closed. She wears a tall, pointed purple witch’s hat adorned with gold crescent moon motifs. Her attire consists of a long, dark purple robe with gold trim and ornate gold patterns, a high-collared purple cloak fastened with a gold brooch, and a black belt with gold buckles around her waist. Her left hand is visible, resting near her hip, while her right hand grips a staff. The staff is tall, slender, and dark, topped with a large, ornate gold crescent moon. The background shows bare, silhouetted tree branches against a large, luminous, pale yellow full moon. The overall color palette is dominated by shades of purple and gold, with the moon providing a bright, warm light source behind her.",
      "type": "image"
    },
```
## Tasks
[] Review the `media-data` endpoint in the server code and fix why the `tags` query parameter is not working.