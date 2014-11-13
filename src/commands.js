define(function (require, exports, module) {
    'use strict';

    var CodeMirror      = brackets.getModule('thirdparty/CodeMirror2/lib/codemirror'),
        Commands        = brackets.getModule('command/Commands'),
        CommandManager  = brackets.getModule('command/CommandManager'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        FileSystem      = brackets.getModule('filesystem/FileSystem'),
        MainViewManager = brackets.getModule('view/MainViewManager'),

        utils   = require('src/utils');

    function closeActiveFile() {
        return CommandManager.execute(Commands.FILE_CLOSE).fail(function () {
            //TODO: implement warning in vim command bar
        });
    }
    
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

    function isViewSplit() {
        return MainViewManager.getPaneCount() === 2;
    }
    
    function openFile(fullPath) {
        var currentDocument = DocumentManager.getCurrentDocument(),
            deferred = $.Deferred();

        function open() {
            CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {fullPath: fullPath})
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

    function prepareNewPane(fullPath) {
        $(MainViewManager).one('paneCreate', function (jqEvent, paneId) {
            CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, { fullPath: fullPath, paneId: paneId })
        });
    }
    
    function splitHorizontally(fullPath) {
        prepareNewPane(fullPath);
        CommandManager.execute(Commands.CMD_SPLITVIEW_HORIZONTAL);
    }
    
    function splitVertically(fullPath) {
        prepareNewPane(fullPath);
        CommandManager.execute(Commands.CMD_SPLITVIEW_VERTICAL);
    }
    
    function unsplit() {
        CommandManager.execute(Commands.CMD_SPLITVIEW_NONE);
    }
    
    // Define all custom ex commands after the vim module is loaded.
    brackets.getModule(['thirdparty/CodeMirror2/keymap/vim'], function () {
        CodeMirror.Vim.defineEx('edit', 'e', function (cm, params) {
            if (!params.hasOwnProperty('args')) {
                // The timeout is used so that the enter key can be released before the quick open dialog is shown,
                // preventing the first file in the dialog list from being immediately opened.
                setTimeout(function () {
                    closeActiveFile().done(function () {
                        CommandManager.execute(Commands.NAVIGATE_QUICK_OPEN);
                    });
                }, 200);
            } else {
                closeActiveFile().done(function () {
                    openFile(utils.resolvePath(params.args[0]));
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

            splitVertically(utils.resolvePath(params.args[0]));
        });

        CodeMirror.Vim.defineEx('split', 'sp', function (cm, params) {
            // Do nothing if already split.
            if (isViewSplit()) {
                return;
            }

            splitHorizontally(utils.resolvePath(params.args[0]));
        });
    });

});
