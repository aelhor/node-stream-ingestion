import test from 'node:test';
import assert from 'node:assert';

import { createReadStream } from 'node:fs';
import { ingestStream } from '../src/core/ingestStream';
import { Readable } from 'node:stream';


test('Milestone 3: Engine handles Sink failure gracefully', async (t) => {
    const source = createReadStream('./test_file_10mb.bin');
    let abortCalled = false;
    let errorCaught = false;

    const chaosSink = {
        write: async (chunk: Buffer) => {
            // Simulate a failure after some data
            throw new Error('DATABASE_OFFLINE');
        },
        finalize: async () => {
            assert.fail('Finalize should NOT be called on error');
        },
        abort: async (err: Error) => {
            abortCalled = true;
            assert.strictEqual(err.message, 'DATABASE_OFFLINE');
        }
    };

    try {
        await ingestStream(source, chaosSink);
    } catch (err: any) {
        errorCaught = true;
        assert.strictEqual(err.message, 'DATABASE_OFFLINE');
    }

    // ASSERTIONS
    assert.ok(errorCaught, 'The engine should re-throw the sink error');
    assert.ok(abortCalled, 'The engine should call sink.abort()');

    // THE MOST IMPORTANT CHECK:
    assert.strictEqual(source.destroyed, true, 'The SOURCE stream must be destroyed after an error');
});


test('Milestone 3: Should destroy source even if validation fails', async (t) => {
    const source = createReadStream('./test_file_10mb.bin');

    try {
        // Passing null as sink to trigger validation error
        await ingestStream(source, null as any);
    } catch (err) {
        // expected
    }

    assert.strictEqual(source.destroyed, true, 'Source must be destroyed even if params were invalid');
});

test('Milestone 3: Should handle source errors', async (t) => {
    const brokenSource = new Readable({
        read: function () {
            this.push('some data');
            this.destroy(new Error('SOURCE_READ_ERROR'));
        }
    })
    let abortError: Error | null = null
    const mockSink = {
        write: async () => { },
        finalize: async () => { assert.fail('Should not finalize'); },
        abort: async (err: Error) => { abortError = err; }
    };
    try {
        await ingestStream(brokenSource, mockSink);
    } catch (err: any) {
        assert.strictEqual(err.message, 'SOURCE_READ_ERROR');
    }

    assert.ok(abortError, 'Sink abort should have been called');
    assert.strictEqual((abortError as any).message, 'SOURCE_READ_ERROR');
});
