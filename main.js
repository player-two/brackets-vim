/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

define(function (require, exports, module) {
    'use strict';

    var AppInit         = brackets.getModule('utils/AppInit'),
        CodeMirror      = brackets.getModule('thirdparty/CodeMirror2/lib/codemirror'),
        CommandManager  = brackets.getModule('command/CommandManager'),
        DefaultDialogs  = brackets.getModule('widgets/DefaultDialogs'),
        Dialogs         = brackets.getModule('widgets/Dialogs'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        EditorManager   = brackets.getModule('editor/EditorManager'),
        ExtensionUtils  = brackets.getModule('utils/ExtensionUtils'),
        FileSystem      = brackets.getModule('filesystem/FileSystem'),
        KeyBindingManager = brackets.getModule('command/KeyBindingManager'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        Menus           = brackets.getModule('command/Menus'),
        ProjectManager  = brackets.getModule('project/ProjectManager'),
        StatusBar       = brackets.getModule('widgets/StatusBar'),

        $vimModeIndicator = $(document.createElement('div')).text('normal'),

        commandId   = 'brackets-vim.toggle',
        currentParentPath = '',
        fileMenu    = Menus.getMenu(Menus.AppMenuBar.FILE_MENU),
        isEnabled   = true,
        projectRoot = '';

    function createFile(filepath) {
        var afterLastSlash = filepath.lastIndexOf('/') + 1,
            filename = filepath.slice(afterLastSlash),
            parentDir = filepath.slice(0, afterLastSlash);
        return ProjectManager.createNewItem(parentDir, filename, true, false)
            .fail(function () {
                Dialogs.showModalDialog(
                    DefaultDialogs.DIALOG_ID_ERROR,
                    'Brackets-Vim: file creation error',
                    'There was an error in the filepath of your vim command.  ' +
                    'Make sure the destination directory of the file already exists.'
                );
            });
    }

    function doesFileExist(filepath, callback) {
        FileSystem.resolve(filepath, function (error, item) {
            callback(error === null);
        });
    }

    function findMatch(directory, partialName, callback) {
        var deferred = $.Deferred();

        FileSystem.resolve(directory, function (notUsed, Directory) {
            var match,
                matchIsFound;

            if (!Array.isArray(Directory._contents) || Directory._contents.length === 0) {
                deferred.reject();
                return;
            }

            matchIsFound = Directory._contents.some(function (item) {
                var doesMatch = item._name.indexOf(partialName) === 0;
                if (doesMatch) {
                    match = item._name;
                    if (item.hasOwnProperty('_isDirectory') && item._isDirectory) {
                        match += '/';
                    }
                }
                return doesMatch;
            });

            if (matchIsFound) {
                deferred.resolve(match);
            } else {
                deferred.reject();
            }
        });

        return deferred.promise();
    }

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
        var args, dirs, inputElement, partialName, relativeParentPath;
        if (event.keyCode === 9) {
            // Check if the vim dialog is focused.
            inputElement = document.activeElement;
            if (inputElement.parentElement.classList.contains('CodeMirror-dialog-bottom')) {
                // Prevent a focus change to the next input in the DOM.
                jqEvent.preventDefault();

                args = jqEvent.target.value.split(' ');
                if (args.length !== 2 || (args[0] !== 'e' && args[0] !== 'vsp' && args[0] !== 'sp')) {
                    return;
                }

                dirs = args[1].split('/');

                // The last element of the dirs array is (possibly) not an actual directory.
                partialName = dirs.pop();
                relativeParentPath = (dirs.length > 0) ? dirs.join('/') + '/' : '';

                findMatch(resolvePath(relativeParentPath), partialName)
                    .done(function (match) {
                        inputElement.value = args[0] + ' ' + relativeParentPath + match;
                    });
            }
        }
    }

    function handleVimModeChange(event) {
        $vimModeIndicator.text(event.mode);
    }

    function openFile(fullPath) {
        var currentDocument = DocumentManager.getCurrentDocument(),
            deferred = $.Deferred();

        function open() {
            CommandManager.execute('file.addToWorkingSet', {fullPath: fullPath})
                .done(deferred.resolve);
        }

        // Do not open the current file.
        if (currentDocument !== null && currentDocument.file._path === fullPath) {
            return;
        }

        doesFileExist(fullPath, function (doesExist) {
            if (doesExist) {
                open();
            } else {
                createFile(fullPath)
                    .done(open);
            }
        });

        return deferred;
    }

    // Transform a partial, relative, or full path into a full path.
    function resolvePath(path) {
        var dirs,
            i = 0,
            parent = '';

        if (path[0] !== '/') {
            if (path.slice(0, 2) === './' || path.slice(0, 3) === '../') {
                parent = currentParentPath;
            } else {
                parent = projectRoot;
            }
        }

        dirs = (parent + path).split('/');

        while (i < dirs.length) {
            switch (dirs[i]) {
                case '':
                    // Leave a preceding or trailing slash.
                    if (i === 0 || i === dirs.length - 1) {
                        i++;
                        break;
                    }
                case '.':
                    dirs.splice(i, 1);
                    break;
                case '..':
                    dirs.splice(i - 1, 2);
                    i -= 1;
                    break;
                default:
                    i++;
                    break;
            }
        }

        return dirs.join('/');
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

    function closeActiveFile() {
        return CommandManager.execute('file.close').fail(function () {
            //TODO: implement warning in vim command bar
        });
    }
    
    function isViewSplit() {
        return MainViewManager.getPaneCount() === 2;
    }
    
    function unsplit() {
        var layout = MainViewManager.getLayoutScheme();
        if (layout.rows === 2) {
            splitHorizontally();
        }
        if (layout.columns === 2 ) {
            splitVertically();
        }
    }
    
    function splitHorizontally() {
        CommandManager.execute('cmd.splitHorizontally');
    }
    
    function splitVertically() {
        CommandManager.execute('cmd.splitVertically');
    }
    
    function prepareNewPane(filePath) {
        $(MainViewManager).one('paneLayoutChange', function (jqEvent, orientation) {
            if (orientation !== null) {
                var file = FileSystem.getFileForPath(filePath);
                MainViewManager.open('second-pane', file);
            }
        });
    }
    
    // Define all custom ex commands after the vim module is loaded.
    brackets.getModule(['thirdparty/CodeMirror2/keymap/vim'], function () {
        CodeMirror.Vim.defineEx('edit', 'e', function (cm, params) {
            if (!params.hasOwnProperty('args')) {
                // The timeout is used so that the enter key can be released before the quick open dialog is shown,
                // preventing the first file in the dialog list from being immediately opened.
                setTimeout(function () {
                    closeActiveFile().done(function () {
                        CommandManager.execute('navigate.quickOpen');
                    });
                }, 200);
            } else {
                closeActiveFile().done(function () {
                    openFile(resolvePath(params.args[0]));
                });
            }
        });

        CodeMirror.Vim.defineEx('quit', 'q', function () {
            closeActiveFile().done(function () {
                if (isViewSplit()) {
                    unsplit();
                }
            });
        });

        CodeMirror.Vim.defineEx('write', 'w', function () {
            CommandManager.execute('file.save');
        });

        CodeMirror.Vim.defineEx('vsplit', 'vsp', function (cm, params) {
            // Do nothing if already split.
            if (isViewSplit()) {
                return;
            }

            prepareNewPane(resolvePath(params.args[0]));
            splitVertically();
        });

        CodeMirror.Vim.defineEx('split', 'sp', function (cm, params) {
            // Do nothing if already split.
            if (isViewSplit()) {
                return;
            }

            prepareNewPane(resolvePath(params.args[0]));
            splitHorizontally();
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
        } else if (workingSet.length === 0) {
            return;
        }

        DocumentManager.getDocumentForPath(workingSet[0]._path).done(function (document) {
            DocumentManager.setCurrentDocument(document);
        });
    });

    $(DocumentManager).on('currentDocumentChange', function () {
        var currentDocument = DocumentManager.getCurrentDocument();
        if (currentDocument !== null) {
            currentParentPath = currentDocument.file._parentPath;
        }
        updateEditorMode();
    });
});
