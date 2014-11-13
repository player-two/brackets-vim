define(function (require, exports, module) {
    'use strict';

    require('src/autocomplete');
    require('src/commands');

    var CodeMirror      = brackets.getModule('thirdparty/CodeMirror2/lib/codemirror'),
        Commands        = brackets.getModule('command/Commands'),
        CommandManager  = brackets.getModule('command/CommandManager'),
        Dialogs         = brackets.getModule('widgets/Dialogs'),
        DocumentManager = brackets.getModule('document/DocumentManager'),
        EditorManager   = brackets.getModule('editor/EditorManager'),
        ExtensionUtils  = brackets.getModule('utils/ExtensionUtils'),
        KeyBindingManager = brackets.getModule('command/KeyBindingManager'),
        MainViewManager = brackets.getModule('view/MainViewManager'),
        Menus           = brackets.getModule('command/Menus'),
        ProjectManager  = brackets.getModule('project/ProjectManager'),
        StatusBar       = brackets.getModule('widgets/StatusBar'),

        $vimModeIndicator = $(document.createElement('div')).text('normal'),

        commandId   = 'brackets-vim.toggle',
        fileMenu    = Menus.getMenu(Menus.AppMenuBar.FILE_MENU),
        isEnabled   = true;

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
            cm[isEnabled ? 'on' : 'off']('vim-mode-change', handleVimModeChange);
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
        var workingSet = MainViewManager.getWorkingSet();
        if (workingSet.length > 1) {
            CommandManager.execute(Commands.FILE_CLOSE_LIST, {
                PaneId: MainViewManager.ALL_PANES,
                fileList: workingSet.slice(1)
            });
        } else if (workingSet.length === 0) {
            return;
        }

        CommandManager.execute(Commands.CMD_ADD_TO_WORKINGSET_AND_OPEN, {fullPath: workingSet[0]._path});
    });

    $(DocumentManager).on('currentDocumentChange', updateEditorMode);
});
