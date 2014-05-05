/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, window */

/** Simple extension that adds a "File > Hello World" menu item */
define(function (require, exports, module) {
    "use strict";

    var AppInit         = brackets.getModule("utils/AppInit"),
        CodeMirror      = brackets.getModule("thirdparty/CodeMirror2/lib/codemirror"),
        CommandManager  = brackets.getModule("command/CommandManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        EditorManager   = brackets.getModule("editor/EditorManager"),
        ExtensionUtils  = brackets.getModule("utils/ExtensionUtils"),
        FileSystem      = brackets.getModule("filesystem/FileSystem"),
        KeyBindingManager = brackets.getModule("command/KeyBindingManager"),
        Menus           = brackets.getModule("command/Menus"),
        ProjectManager  = brackets.getModule("project/ProjectManager"),

        commandId   = "brackets-vim.toggle",
        isEnabled   = true,
        isSplit     = false,
        menu        = Menus.getMenu(Menus.AppMenuBar.FILE_MENU),
        rootPath    = "";

    /*
    TODO:
    - split if multiple files start in working set
    - divider bar for split view
    - add vim's mode to status bar
    */

    // Splits the UI so that two documents may be viewed at the same time.
    function split() {
        var workingSet = DocumentManager.getWorkingSet();

        if (workingSet.length !== 2 || isSplit === true) {
            console.log(workingSet.length, isSplit);
            return;
        }

        console.log('splitting');

        isSplit = true;
        $(".CodeMirror").addClass("split-editor");
    }

    // Revert the UI back to a single-document view.
    function unsplit() {
        isSplit = false;
        $(".CodeMirror").removeClass("split-editor");
    }

    function updateEditorMode() {
        var cm,
            activeEditor = EditorManager.getActiveEditor();

        if (activeEditor === null) {
            return;
        }

        cm = activeEditor._codeMirror;

        // Patch the esc key, which does not properly exit insert or visual mode in Brackets.
        // This is likely due to Brackets, since the demo at codemirror.net/demo/vim.html works fine.
        function handleEscKey(jqEvent, editor, event) {
            if (event.type === "keydown" && event.keyCode === 27) {
                var cm = editor._codeMirror,
                    vimState = cm.state.vim;

                if (vimState.insertMode === true) {
                    CodeMirror.keyMap["vim-insert"].Esc(cm);
                    //CodeMirror.Vim.handleKey(cm, 'Ctrl-C');
                } else if (vimState.visualMode === true) {
                    CodeMirror.Vim.handleKey(cm, "v");
                }
            }
        }

        if (isEnabled !== cm.getOption("vimMode")) {
            cm.setOption("vimMode", isEnabled);

            $(activeEditor).off("keyEvent", handleEscKey);
            if (isEnabled) {
                $(activeEditor).on("keyEvent", handleEscKey);
            }
        }

        //cm.on('vim-mode-change', handleModeChange);
    }

    function toggleVim(editor) {
        isEnabled = !isEnabled;
        CommandManager.get(commandId).setChecked(isEnabled);
        updateEditorMode();
    }

    // Define all custom ex commands after the vim module is loaded.
    brackets.getModule(["thirdparty/CodeMirror2/keymap/vim"], function () {
        CodeMirror.Vim.defineEx("edit", "e", function (cm, params) {
            if (!params.hasOwnProperty('args')) {
                // The timeout is used so that the enter key can be released before the quick open dialog is shown,
                // preventing the first file in the dialog list from being immediately opened.
                setTimeout(function () {
                    CommandManager.execute("file.close");
                    CommandManager.execute("navigate.quickOpen");
                }, 200);
            } else {
                CommandManager.execute("file.close");
                CommandManager.execute("file.addToWorkingSet", {fullPath: rootPath + params.args[0]});
            }
        });

        CodeMirror.Vim.defineEx("quit", "q", function () {
            CommandManager.execute("file.close");

            if (isSplit) {
                isSplit = false;
                $('.CodeMirror').removeClass('split-editor');
            }
        });

        CodeMirror.Vim.defineEx("write", "w", function () {
            CommandManager.execute("file.save");
        });

        CodeMirror.Vim.defineEx("vsplit", "vsp", function (cm, params) {
            if (isSplit) {
                return;
            }

            CommandManager.execute("file.addToWorkingSet", {fullPath: rootPath + params.args[0]}).done(split);
        });
    });

    // Register the enable command.
    CommandManager.register("Enable Vim", commandId, toggleVim);
    CommandManager.get(commandId).setChecked(isEnabled);

    // Doesn't work yet.
    KeyBindingManager.addBinding("navigate.nextDoc", "Ctrl-w");

    // Then create a menu item bound to the command
    // The label of the menu item is the name we gave the command (see above)
    menu.addMenuDivider();
    menu.addMenuItem(commandId);

    ExtensionUtils.loadStyleSheet(module, "main.css");

    $(ProjectManager).on("projectOpen", function (jqEvent, directory) {
        rootPath = directory._path;

        // Ensure that at most two files are working when the project opens.
        // Temporarily set to one until split on init is working.
        var workingSet = DocumentManager.getWorkingSet();
        if (workingSet.length > 1) {
            console.log(workingSet.length, "files open");
            DocumentManager.removeListFromWorkingSet(workingSet.slice(1));
        }
    });

    $(DocumentManager).on("currentDocumentChange", function () {
        console.log('doc change');
        updateEditorMode();
    });

    AppInit.appReady(function () {
        console.log('app ready');
    });
});
