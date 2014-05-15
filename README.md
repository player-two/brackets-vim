## Brackets Vim

This is a Brackets extension to enable and enhance the [CodeMirror vim keybindings](codemirror.net/demo/vim.html).

## How to use

Use of the extension is controlled through the menu item labeled "Enable Vim" that has been added to the File menu.  If the item is checked, then you are a [real programmer](xkcd.com/378/).

## Keybindings

Some vim keybindings may interfere with the default Brackets keybindings, in which case the Brackets keybinding will take precedence.  There is an extension, namely Brackets Key Remapper, that will allow you to remove these defaults.  Here are some bindings that I have changed:

| Keybinding | Default function | Mapped to |
| ---------- | ---------------- | --------- |
| Ctrl-D     | duplicate        | none      |
| Ctrl-Tab   | next document    | none      |
| Ctrl-W     | close            | next document |

## File operations

Using normal file operations may break the extension.  Therefore, use only the file commands in the table below instead of opening files from the file tree or menu.

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

## Splitting

One of the features crucial to my vim usage was splitting the window using the :vsp and :sp commands.  To replicate this in Brackets, the extension manages the Working Files list and the editor CSS.  As such, splitting causes issues when panes are opened in the editor (usually at the bottom of the window by use of an extension).  Rest assured this is a high priority issue.

## Future concerns

* Allow :e and :vsp commands to create a new file.
* Fix display issues when a pane is open while splitting.
* Add :sp support.