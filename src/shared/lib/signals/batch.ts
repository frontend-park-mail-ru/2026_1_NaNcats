import type { Owner } from './owner';

/** Флаг: внутри активного batch. Чтения и записи это видят. */
let batching = false;

/**
 * Очередь reactive-узлов, чьи источники уже изменились, но перезапуск
 * отложен до конца batch. Set дедуплицирует: один узел один раз.
 */
const batchQueue: Set<Owner> = new Set();

/**
 * Возвращает true, если код выполняется внутри batch. Сигналы используют
 * это, чтобы решать: уведомить подписчиков немедленно или отложить.
 *
 * @returns true внутри batch, иначе false.
 */
export function isBatching(): boolean {
    return batching;
}

/**
 * Добавляет узел в очередь batch для последующего перезапуска. Вызывается
 * сигналом при set, если активен batch.
 *
 * @param node Reactive-узел (effect или computed), который нужно перезапустить.
 */
export function enqueueBatch(node: Owner): void {
    batchQueue.add(node);
}

/**
 * Откладывает уведомление подписчиков до конца fn. Все вызовы signal.set
 * внутри fn попадают в общую очередь, дубли отбрасываются, а после возврата
 * из fn очередь сливается одним проходом.
 *
 * При выбросе исключения из fn очередь всё равно сливается: иначе зависшие
 * незапущенные узлы могли бы попасть в неконсистентное состояние при
 * следующем set. Если же отдельный узел внутри флаша кидает, ошибка
 * логируется и обработка следующих узлов продолжается: один сломанный
 * эффект не должен ронять весь batch.
 *
 * Вложенные batch'и: внутренний batch не флашит очередь, флашит только
 * самый внешний. Это даёт ожидаемое поведение для атомарных групп.
 *
 * @template R Тип возвращаемого значения fn.
 * @param fn Функция, внутри которой set'ы будут отложены.
 * @returns Значение, возвращённое fn.
 */
export function batch<R>(fn: () => R): R {
    if (batching) {
        return fn();
    }
    batching = true;
    try {
        return fn();
    } finally {
        try {
            flush();
        } finally {
            batching = false;
        }
    }
}

/**
 * Сливает очередь: запускает все накопленные узлы. Во время флаша новые
 * узлы могут попасть в очередь (например, если один effect триггерит другой
 * через set), и они тоже будут обработаны в рамках того же флаша.
 */
function flush(): void {
    while (batchQueue.size > 0) {
        const tasks = Array.from(batchQueue);
        batchQueue.clear();
        for (const node of tasks) {
            if (node.disposed) continue;
            const fn = node.fn;
            if (!fn) continue;
            try {
                fn();
            } catch (err) {
                console.error('[signals] batch effect throw:', err);
            }
        }
    }
}
