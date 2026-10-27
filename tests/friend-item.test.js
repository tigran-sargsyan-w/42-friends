import test from "node:test";
import assert from "node:assert/strict";

// Only DOM methods used by the card renderer are needed for this smoke test.
class Element {
    constructor(tagName) {
        this.tagName = tagName.toUpperCase();
        this.children = [];
        this.style = {};
        this.className = "";
        this.textContent = "";
        this.classList = {
            add: name => { this.className += " " + name; }
        };
    }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener() {}
    remove() {}
}

globalThis.chrome = { storage: { sync: {} } };
globalThis.document = {
    createElement: name => new Element(name),
    body: new Element("body")
};
globalThis.window = { open() {}, innerWidth: 1200, innerHeight: 800 };
const { createFriendItem } = await import("../src/content/ui/friend-item.js");

function render({ profile = {}, logtime = {}, stale = true, logtimeStale = true } = {}) {
    const container = new Element("div");
    createFriendItem({
        container,
        friend: "alice",
        today: "2026-10-27",
        friendObject: profile,
        logTimeObject: logtime,
        isPinned: true,
        isStale: stale,
        isLogtimeStale: logtimeStale,
        onRefresh: async () => {}
    });
    return container;
}

test("renders saved friend even if no network response or cache exists", () => {
    const root = render();
    assert.equal(root.children.length, 1);
    assert.match(root.children[0].className, /tf-friend-item--pinned/);
    const details = root.children[0].children[1];
    assert.equal(details.children[0].children[0].textContent, "alice");
    assert.equal(details.children[1].textContent, "Logtime unknown");
    const actions = root.children[0].children[2];
    assert.equal(actions.children[0].textContent, "Status unknown");
});

test("renders fresh online friend and fresh logtime without fallback", () => {
    const root = render({
        profile: { location: "z1r2p3", displayname: "Alice" },
        logtime: { "2026-10-27": "04:30" },
        stale: false,
        logtimeStale: false
    });
    assert.equal(root.children.length, 1);
    assert.equal(root.children[0].children[1].children[1].textContent, "04h30 today");
    assert.equal(root.children[0].children[2].children[0].textContent, "z1r2p3");
});
