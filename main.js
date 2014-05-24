/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {
    'use strict';

    var AppInit         = brackets.getModule('utils/AppInit'),
        CodeMirror      = brackets.getModule('thirdparty/CodeMirror2/lib/codemirror'),
        CommandManager  = brackets.getModule('command/CommandManager'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        EditorManager   = brackets.getModule('editor/EditorManager'),
        ExtensionUtils  = brackets.getModule('utils/ExtensionUtils'),
        FileSystem      = brackets.getModule('filesystem/FileSystem'),
        KeyBindingManager = brackets.getModule('command/KeyBindingManager'),
        Menus           = brackets.getModule('command/Menus'),
        ProjectManager  = brackets.getModule('project/ProjectManager'),
        StatusBar       = brackets.getModule('widgets/StatusBar'),

        $editorHolder = $('#editor-holder'),
        $vimModeIndicator = $(document.createElement('div')).text('normal'),

        commandId   = 'brackets-vim.toggle',
        fileMenu    = Menus.getMenu(Menus.AppMenuBar.FILE_MENU),
        isEnabled   = true,
        isSplit     = false,
        projectRoot = '';

    // Patch the esc key, which does not properly exit insert or visual mode in Brackets.
    // This is likely due to Brackets, since the demo at codemirror.net/demo/vim.html works fine.
    function handleEscKey(jqEvent, editor, event) {
        if (event.type === 'keydown' && event.keyCode === 27) {
            var cm = editor._codeMirror,
                vimState = cm.state.vim;

            if (vimState.insertMode === true) {
                CodeMirror.keyMap['vim-insert'].Esc(cm);
                //CodeMirror.Vim.handleKey(cm, 'Ctrl-C');
            } else if (vimState.visualMode === true) {
                CodeMirror.Vim.handleKey(cm, 'v');
            }
        }
    }

    // Extend the vim command dialog to autocomplete filepaths with the tab key.
    function handleTabKey(jqEvent) {
        var args, dirs, fullPath, inputElement, partialName, relativePath;
        if (event.keyCode === 9) {
            // Check if the vim dialog is focused.
            inputElement = document.activeElement;
            if (inputElement.parentElement.classList.contains('CodeMirror-dialog-bottom')) {
                // Prevent a focus change to the next input in the DOM.
                jqEvent.preventDefault();

                args = jqEvent.target.value.split(' ');
                if (args.length !== 2 || (args[0] !== 'e' && args[0] !== 'vsp')) {
                    return;
                }

                dirs = args[1].split('/');

                // The last element of the dirs array is (possibly) not an actual directory.
                partialName = dirs.pop();
                relativePath = dirs.join('/');

                // Ensure the last character of the path is a slash.
                if (relativePath.length > 0) {
                    relativePath += '/';
                }

                // Check to see if the path is relative to the current file (instead of the project root).
                // This is denoted with the './' prefix.
                if (relativePath.slice(0, 2) === './') {
                    relativePath = EditorManager.getActiveEditor().document.file._parentPath.slice(projectRoot.length);
                }

                FileSystem.resolve(projectRoot + relativePath, function (notUsed, Directory) {
                    var match = '';
                    Directory._contents.forEach(function (item) {
                        if (item._name.indexOf(partialName) === 0) {
                            match = item._name;
                            if (item.hasOwnProperty('_isDirectory') && item._isDirectory) {
                                match += '/';
                            }
                        }
                    });

                    if (match.length > 0) {
                        inputElement.value = args[0] + ' ' + relativePath + match;
                    }
                });
            }
        }
    }

    function handleVimModeChange(event) {
        $vimModeIndicator.text(event.mode);
    }

    // Splits the UI so that two documents may be viewed at the same time.
    function split() {
        isSplit = true;
        $editorHolder.addClass('split-view');
    }

    // Toggles vim functionality in the editor.
    // This function is run by the menu item.
    function toggleVim(editor) {
        isEnabled = !isEnabled;
        CommandManager.get(commandId).setChecked(isEnabled);
        if (isEnabled) {
            $(document).on('keydown', handleTabKey);
        } else {
            $(document).off('keydown', handleTabKey);
        }
        updateEditorMode();
    }

    // Revert the UI back to a single-document view.
    function unsplit() {
        isSplit = false;
        $editorHolder.removeClass('split-view');
    }

    // Update the active editor with the vim mode.
    function updateEditorMode() {
        var cm,
            activeEditor = EditorManager.getActiveEditor();

        if (activeEditor === null) {
            return;
        }

        cm = activeEditor._codeMirror;

        if (isEnabled !== cm.getOption('vimMode')) {
            cm.setOption('vimMode', isEnabled);

            if (isEnabled) {
                cm.on('vim-mode-change', handleVimModeChange);
                $(activeEditor).on('keyEvent', handleEscKey);
            } else {
                cm.off('vim-mode-change', handleVimModeChange);
                $(activeEditor).off('keyEvent', handleEscKey);
            }
        }
    }

    // Define all custom ex commands after the vim module is loaded.
    brackets.getModule(['thirdparty/CodeMirror2/keymap/vim'], function () {
        CodeMirror.Vim.defineEx('edit', 'e', function (cm, params) {
            if (!params.hasOwnProperty('args')) {
                // The timeout is used so that the enter key can be released before the quick open dialog is shown,
                // preventing the first file in the dialog list from being immediately opened.
                setTimeout(function () {
                    CommandManager.execute('file.close');
                    CommandManager.execute('navigate.quickOpen');
                }, 200);
            } else {
                CommandManager.execute('file.close');
                CommandManager.execute('file.addToWorkingSet', {fullPath: projectRoot + params.args[0]});
            }
        });

        CodeMirror.Vim.defineEx('quit', 'q', function () {
            CommandManager.execute('file.close');

            if (isSplit) {
                unsplit();
            }
        });

        CodeMirror.Vim.defineEx('write', 'w', function () {
            CommandManager.execute('file.save');
        });

        CodeMirror.Vim.defineEx('vsplit', 'vsp', function (cm, params) {
            // Do nothing if already split.
            if (isSplit) {
                return;
            }

            var relativePath = params.args[0];

            // Do not split the same file (Brackets will not allow it).
            if (relativePath === EditorManager.getActiveEditor().document.file._name) {
                return;
            }

            CommandManager.execute('file.addToWorkingSet', {fullPath: projectRoot + relativePath}).done(split);
        });

        CodeMirror.Vim.defineEx('unsplit', 'unsplit', function () {
            if (isSplit) {
                unsplit();
            }
        });
    });

    // Register the enable command.
    CommandManager.register('Enable Vim', commandId, toggleVim);
    CommandManager.get(commandId).setChecked(isEnabled);
    if (isEnabled) {
        $(document).on('keydown', handleTabKey);
    }

    // Add the enable command to the file menu.
    fileMenu.addMenuDivider();
    fileMenu.addMenuItem(commandId);

    ExtensionUtils.loadStyleSheet(module, 'main.css');

    StatusBar.addIndicator('vim-mode', $vimModeIndicator, true);

    // Doesn't work yet.
    //KeyBindingManager.addBinding('navigate.nextDoc', 'Ctrl-w');

    $(ProjectManager).on('projectOpen', function (jqEvent, directory) {
        projectRoot = directory._path;

        // Ensure that at most one file is working when the project opens.
        var workingSet = DocumentManager.getWorkingSet();
        if (workingSet.length > 1) {
            DocumentManager.removeListFromWorkingSet(workingSet.slice(1));
        }

        DocumentManager.getDocumentForPath(workingSet[0]._path).done(function (document) {
            DocumentManager.setCurrentDocument(document);
        });
    });

    $(DocumentManager).on('currentDocumentChange', function () {
        updateEditorMode();
    });
});
