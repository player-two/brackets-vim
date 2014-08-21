define(function (require, exports, module) {
    'use strict';

    require('autocomplete');
    require('commands');

    var CodeMirror      = brackets.getModule('thirdparty/CodeMirror2/lib/codemirror'),
        CommandManager  = brackets.getModule('command/CommandManager'),
        Dialogs         = brackets.getModule('widgets/Dialogs'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        EditorManager   = brackets.getModule('editor/EditorManager'),
        ExtensionUtils  = brackets.getModule('utils/ExtensionUtils'),
        KeyBindingManager = brackets.getModule('command/KeyBindingManager'),
        Menus           = brackets.getModule('command/Menus'),
        ProjectManager  = brackets.getModule('project/ProjectManager'),
        StatusBar       = brackets.getModule('widgets/StatusBar'),

        $vimModeIndicator = $(document.createElement('div')).text('normal'),

        commandId   = 'brackets-vim.toggle',
        fileMenu    = Menus.getMenu(Menus.AppMenuBar.FILE_MENU),
        isEnabled   = true;

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

    function handleVimModeChange(event) {
        $vimModeIndicator.text(event.mode);
    }

    // Toggles vim functionality in the editor.
    // This function is run by the menu item.
    function toggleVim(editor) {
        isEnabled = !isEnabled;
        CommandManager.get(commandId).setChecked(isEnabled);
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

    // Register the enable command.
    CommandManager.register('Enable Vim', commandId, toggleVim);
    CommandManager.get(commandId).setChecked(isEnabled);

    // Add the enable command to the file menu.
    fileMenu.addMenuDivider();
    fileMenu.addMenuItem(commandId);

    ExtensionUtils.loadStyleSheet(module, 'main.css');

    StatusBar.addIndicator('vim-mode', $vimModeIndicator, true);

    $(ProjectManager).on('projectOpen', function (jqEvent, directory) {
        // Ensure that at most one file is working when the project opens.
        var workingSet = DocumentManager.getWorkingSet();
        if (workingSet.length > 1) {
            DocumentManager.removeListFromWorkingSet(workingSet.slice(1));
        } else if (workingSet.length === 0) {
            return;
        }

        DocumentManager.getDocumentForPath(workingSet[0]._path).done(function (doc) {
            DocumentManager.setCurrentDocument(doc);
        });
    });

    $(DocumentManager).on('currentDocumentChange', updateEditorMode);
});
