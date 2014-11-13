define(function (require, exports, module) {
    'use strict';

    var ProjectManager  = brackets.getModule('project/ProjectManager');

    // Transform a partial, relative, or full path into a full path.
    function resolvePath(path) {
        var i = 0,
            parent = path[0] === '/' ? '' : ProjectManager.getProjectRoot().fullPath,
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

    exports.resolvePath = resolvePath;

});
