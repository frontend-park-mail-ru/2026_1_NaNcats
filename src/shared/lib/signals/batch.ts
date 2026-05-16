import type { Owner } from './owner';

/** Флаг: внутри активного batch. Чтения и записи это видят. */
let batching = false;

/**
 * Очередь reactive-узлов, чьи источники уже изменились, но перезапуск
 * отложен до конца batch. Set дедуплицирует: один узел один раз.
 */
const batchQueue: Set<Owner> = new Set();

/**
 * Возвращает true, если код выполняется внутри batch.
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
 * Откладывает уведомление подписчиков до конца fn: set'ы внутри fn попадают в
 * общую очередь (дубли отбрасываются), после возврата очередь сливается одним
 * проходом. При исключении из fn очередь всё равно сливается; ошибка отдельного
 * узла логируется и не останавливает остальные. Очередь флашит только самый
 * внешний batch.
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
 * Сливает очередь: запускает все накопленные узлы. Узлы, добавленные во время
 * флаша, обрабатываются в том же флаше.
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
