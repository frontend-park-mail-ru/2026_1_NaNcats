/**
 * Плагин для jsdoc, убирающий побочный doclet класса, который better-docs
 * генерирует из конструктора.
 *
 * better-docs для каждого метода класса добавляет в исходник строку вида
 * `ClassName.prototype.methodName`, а для конструктора получается
 * `ClassName.prototype.ClassName`. jsdoc регистрирует это как вложенный
 * класс с longname `ClassName#ClassName`, в результате чего на каждый
 * настоящий класс появляется ещё одна пустая страница 
 *
 * better-docs publish.js собирает страницы классов запросом
 * `find(data, { kind: 'class', component: { isUndefined: true } })`.
 * Если у дубликат-doclet'а сменить `kind` на что-то отличное от 'class',
 * запрос его пропустит: страница не сгенерируется и в навигации он не
 * появится. Каскадных эффектов на остальные doclet'ы класса нет, так
 * как methods числятся `memberof: 'ClassName'`, а не `'ClassName#ClassName'`.
 */
exports.handlers = {
    newDoclet({ doclet }) {
        if (!doclet || doclet.kind !== 'class') return;
        if (typeof doclet.longname !== 'string') return;
        const parts = doclet.longname.split('#');
        if (parts.length === 2 && parts[0] === parts[1]) {
            doclet.kind = 'member';
        }
    },
};
