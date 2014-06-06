## Brackets Vim

This is a Brackets extension to enable and enhance the [CodeMirror vim keybindings](http://codemirror.net/demo/vim.html).

## How to use

Use of the extension is controlled through the menu item labeled "Enable Vim" that has been added to the File menu.  If the item is checked, then you are a [real programmer](http://xkcd.com/378/).

## Keybindings

Some vim keybindings may interfere with the default Brackets keybindings, in which case the Brackets keybinding will take precedence.  There is an extension, namely Brackets Key Remapper, that will allow you to remove these defaults.  Here are some bindings that I have changed:

| Keybinding | Default function | Mapped to |
| ---------- | ---------------- | --------- |
| Ctrl-D     | duplicate        | none      |
| Ctrl-Tab   | next document    | none      |
| Ctrl-W     | close            | next document |

## Splitting

One of the features crucial to my vim usage was splitting the window using the :vsp and :sp commands.  To replicate this in Brackets, the extension manages the Working Files list and the editor CSS.  As such, splitting causes issues when panes are opened in the editor (usually at the bottom of the window by use of an extension).

As pointed out by [@sbruchmann](https://github.com/sbruchmann), the Brackets team is working on their own support for editor splitting.  The extension will be migrated once that feature is released.

## File operations

Using normal file operations (e.g. double clicking a file in the tree) may break the splitting feature of the extension.  Therefore, if using window splitting, use only the file commands in the table below (:e and :vsp) instead of opening files from the file tree or menu.

To encourage and facilitate the use of the vim file commands, the tab autocomplete feature has been replicated.  Press the tab key after typing a partial path to search for a file or directory matching the command argument.  The following syntaxes are supported:

:e [path relative to project root]  
:e ./[path relative to open file]  
:e ../[path relative to open file]

The first character of the path should not be a slash (/).

## Commands

| Command   | Format    |
| --------- | --------- |
| edit      | :e *filename* |
| write     | :w        |
| quit      | :q        |
| vertical split | :vsp *filename* |
| search    | /*string* |
| substitute| :[range]s/*pattern*/*string*/[*flags*] |
| undo*     | :u        |

*alias for "u" when in normal mode

## Future concerns

* Monitor Brackets' splitview - [issue 4](https://github.com/megalord/brackets-vim/issues/4)