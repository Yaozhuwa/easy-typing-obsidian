# Edit Enhancements

Easy Typing plugin provides various editing enhancements to optimize the user's editing experience.

## Main Features

### 1. Symbol Auto-pairing/Deletion

- Automatically completes the right half of a symbol pair when the left half is entered
- Supported symbol pairs include: 【】, （）, 《》, "", '', 「」, 『』
- When the cursor is between paired symbols, pressing the delete key will delete the entire symbol pair

### 2. Symbol Editing Enhancement for Selected Text

When text is selected:
- Entering 【 will convert the text to [[text]]
- Entering ￥ will convert the text to $text$
- Entering · will convert the text to `text`
- Entering other paired symbols (such as 《》, "", '', etc.) will add the corresponding symbols on both sides of the text

### 3. Continuous Full-width Symbol to Half-width Conversion

Continuously entering two full-width symbols will automatically convert them to the corresponding half-width symbols, for example:
- 。。 converts to .
- ！！ converts to !
- ；； converts to ;
- ，， converts to ,
- ：： converts to :
- ？？ converts to ?
- 、、 converts to /
- （（ converts to ()

### 4. Obsidian Syntax-related Editing Enhancements

- Continuously entering two ￥ will become $$, with the cursor positioned in the middle
- Continuously entering two 【 will become [[]]
- Continuously entering · three times will become ```

## Usage

1. Enable the corresponding editing enhancement features in the plugin settings
2. These features will automatically take effect during editing

## Notes

- These features are designed to improve the editing efficiency of Chinese users in Obsidian
- Some features may overlap with other plugins or Obsidian's built-in functions, please adjust according to personal needs
