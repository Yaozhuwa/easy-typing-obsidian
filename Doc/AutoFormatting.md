# Text Auto-formatting

Easy Typing plugin provides powerful text auto-formatting features that automatically format text during input based on user-defined rules.

## Main Features

### 1. Auto Capitalize

- Automatically capitalizes the first letter of each sentence in English input mode
- Can be set to work only when typing or globally
- In typing-only mode, auto-capitalization can be undone

### 2. Auto Space between Chinese and English

- Automatically adds spaces between Chinese and English text
- Can be set to add spaces between Chinese characters and numbers

### 3. Auto Space between Punctuation and Text

- Intelligently adds spaces between text and English punctuation

### 4. Space Strategies for Different Blocks

The plugin divides text lines into several types of blocks:
- Text block
- Inline formula block
- Inline code block
- Link block
- User-defined regular expression block

Each type of block can have one of three space strategies:
1. No requirement: No space requirement between this block and others
2. Soft space: This block can be separated from others by soft spaces (e.g., punctuation)
3. Strict space: This block must be separated from others by a space

### 5. Custom Regular Expression Blocks

Users can define special blocks using custom regular expressions and set specific space strategies for these blocks. This is very useful for handling text with special formats.

For more details on this feature, please refer to the [User-defined Regular Expression Blocks](./UserDefinedRegExp.md) document.

## Usage

1. Enable auto-formatting in the plugin settings
2. Adjust various settings as needed
3. The plugin will automatically apply formatting rules during editing

## Notes

- Auto-formatting is enabled by default and works in real-time during editing
- You can use plugin commands to format the entire current article, the current line, or the currently selected area
- Certain special areas (such as code blocks, math formulas) will not be auto-formatted
