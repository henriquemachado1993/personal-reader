import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnreferencedOriginal } from "../src/infrastructure/r2/retention.mjs";
test("retention protects referenced originals, malformed libraries and other owners",()=>{
 assert.equal(isUnreferencedOriginal("a","a/originals/book",{documents:[{id:"book"}]}),false);
 assert.equal(isUnreferencedOriginal("a","b/originals/book",{documents:[]}),false);
 assert.equal(isUnreferencedOriginal("a","a/originals/book",null),false);
 assert.equal(isUnreferencedOriginal("a","a/originals/book",{documents:[]}),true);
});
