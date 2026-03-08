"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEATURE_FLAGS_STUB = void 0;
var logger_1 = require("./utils/logger");
var FN_UNDEFINED = function () { };
var FN_ARRAY = function () { return []; };
var FN_OBJECT = function () { return ({}); };
var FN_CALLBACK = function () { return function () { }; };
// Stub returned by the featureFlags getter when PostHogFeatureFlags is not loaded (e.g. slim bundle).
// Known defaults are explicit (mangle-safe), the Proxy catches any future methods with a logged no-op.
var stubTarget = {
    $anon_distinct_id: undefined,
    _override_warning: false,
    featureFlagEventHandlers: [],
    hasLoadedFlags: false,
    getFlags: FN_ARRAY,
    getFlagsWithDetails: FN_OBJECT,
    getFlagVariants: FN_OBJECT,
    getFlagPayloads: FN_OBJECT,
    onFeatureFlags: FN_CALLBACK,
    _prepareFeatureFlagsForCallbacks: function () { return ({ flags: [], flagVariants: {} }); },
};
// Proxy catches unknown methods with a logged no-op. On IE11 (no Proxy), fall back to the
// plain object — known methods still work, you just lose the catch-all and error log.
exports.FEATURE_FLAGS_STUB = (typeof Proxy !== 'undefined'
    ? new Proxy(stubTarget, {
        get: function (target, p) {
            logger_1.logger.error('[PostHog] Feature flags is not yet loaded or not included in this bundle');
            return p in target ? target[p] : FN_UNDEFINED;
        },
    })
    : stubTarget);
//# sourceMappingURL=posthog-featureflags-stub.js.map