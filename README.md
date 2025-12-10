# Parse Tree Visualizer

A powerful, web-based tool to visualize parse trees for any **Context-Free Grammar (CFG)**.  
Built with vanilla JavaScript and **D3.js**, this application implements the **Earley Parsing Algorithm**, making it capable of handling all CFGs, including those with:
- **Ambiguity** (finds a valid parse tree)
- **Left Recursion** (no infinite loops)
- **Epsilon Productions**

## 🚀 Quick Start

1. **Clone or Download** this repository.
2. Open `index.html` in any modern web browser.
3. No server or installation required!

## 📖 How to Use

1. **Start Symbol**: Enter the non-terminal symbol you want to start parsing from (default: `E`).
2. **Grammar Input**: Enter your grammar rules in the text area.
   - Use `->` to separate Left-Hand Side (LHS) and Right-Hand Side (RHS).
   - Use `|` for alternative productions.
   - Separate tokens with spaces.
   - Example:
     ```text
     E -> E + T | T
     T -> T * F | F
     F -> ( E ) | id
     ```
3. **Test String**: Enter the string you want to parse.
   - Tokens must be space-separated.
   - Example: `id + id * id`
4. **Visualize**: Click the button to render the tree!

## 🛠️ Technical Details

- **Algorithm**: [Earley Parser](https://en.wikipedia.org/wiki/Earley_parser). This allows the tool to parse *any* context-free grammar, unlike LL(k) or LR(k) parsers which are more restricted.
- **Visualization**: [D3.js v7](https://d3js.org/) is used to render the clean, interactive tree structure.
- **Architecture**: Single-Page Application (SPA). All logic resides in `script.js`.

## 📂 Project Structure

- `index.html`: Main entry point and UI layout.
- `style.css`: Modern, responsive styling.
- `script.js`: Contains the `EarleyParser` class, `buildTree` logic, and D3.js rendering code.
- `README.md`: Project documentation.

## 📝 Grammar Syntax Rules

- **Non-Terminals**: Any string on the LHS of a rule.
- **Terminals**: Any string that does not appear on the LHS of a rule.
- **Epsilon (Empty)**: If a rule produces nothing `A -> `, it is treated as an epsilon production. You can also explicitly use `ε`, `""`, or `''` though they are treated as tokens if not handled specifically by the tokenizer logic (currently handled as empty).

## ⚠️ Known Limitations

- The lexer is simple: it splits by whitespace. Ensure all your tokens (including parentheses `(` `)`) are separated by spaces.
- For ambiguous grammars, the visualizer currently picks the first valid derivation found in the parse chart.

## 📄 License

MIT License. Feel free to use and modify!
