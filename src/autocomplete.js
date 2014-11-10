define(function (require, exports, module) {
    'use strict';

    var FileSystem = brackets.getModule('filesystem/FileSystem'),

        utils = require ('src/utils');

    function doFileCompletion(args) {
        if (args.length !== 2) {
            return $.Deferred().resolve(args.join(' '));
        } else {
            return getCompletion(args[1]).then(function (completion) {
                return args[0] + ' ' + completion;
            });
        }
    }

    function findInArray(arr, str) {
        // Give preference to a full match.
        var index = arr.indexOf(str);
        if (index !== -1) {
            return arr[(index + 1) % arr.length];
        } else {
            return findPartialInArray(arr, str);
        }
    }

    function findMatchingFilename(directoryPath, partialName) {
        var deferred = $.Deferred();

        FileSystem.resolve(directoryPath, function (err, directory, stat) {
            var children;

            if (err !== null) {
                return deferred.resolve(partialName);
            }

            children = directory._contents.map(function (child) {
                return child._name + (child.hasOwnProperty('_isFile') && child._isFile ? '' : '/');
            });

            return deferred.resolve(findInArray(children, partialName));
        });

        return deferred.promise();
    }

    function findPartialInArray(arr, str) {
        var i = 0;
        while(i < arr.length && arr[i].indexOf(str) === -1) {
            i++;
        }

        if (i === arr.length) {
            return str;
        } else {
            return arr[i];
        }
    }

    // Extend the vim command dialog to autocomplete filepaths with the tab key.
    function getCompletion(partialPath) {
        var dirs = partialPath.split('/'),
            // The last element of the dirs array is (possibly) not an actual directory.
            partialName = dirs.pop(),
            relativeParentPath = (dirs.length > 0) ? dirs.join('/') + '/' : '';

        return findMatchingFilename(utils.resolvePath(relativeParentPath), partialName)
            .then(function (match) {
                return relativeParentPath + match;
            });
    }

    function getNewCommand(command) {
        var args = command.split(' ');
        switch (args[0]) {
            case 'e':
            case 'sp':
            case 'vsp':
                return doFileCompletion(args);
            default:
                return $.Deferred().resolve(command);
        }
    }

    function handleKeydown(jqEvent) {
        if (jqEvent.keyCode === 9) {
            handleTabKey(jqEvent);
        }
    }

    function handleTabKey(jqEvent) {
        // Check if the vim dialog is focused.
        var inputElement = document.activeElement;
        if (inputElement.parentElement.classList.contains('CodeMirror-dialog-bottom')) {
            // Prevent a focus change to the next input in the DOM.
            jqEvent.preventDefault();
            rewriteCommand(inputElement);
        }
    }

    function rewriteCommand(inputElement) {
        getNewCommand(inputElement.value).done(function (command) {
            inputElement.value = command;
        });
    }

    $(document).on('keydown', handleKeydown);

});
