import test from "node:test";
import assert from "node:assert/strict";

class MockElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.children = [];
        this.className = "";
        this.style = {};
        this.textContent = "";
        this.classList = { add: name => { this.className += " " + name; } };
    }
    appendChild(element) { this.children.push(element); return element; }
    addEventListener() {}
    remove() {}
}
globalThis.chrome = { storage: { sync: {} } };
globalThis.document = {
    createElement: name => new MockElement(name),
    body: new MockElement("body")
};
globalThis.window = { open() {}, innerWidth: 1500, innerHeight: 800 };
const { createFriendItem } = await import("../src/content/ui/friend-item.js");

test("renders a saved login immediately, before profile is loaded", () => {
    const container = new MockElement("section");
    createFriendItem({
        container, friend: "alice", today: "2026-10-27",
        friendObject: {}, logTimeObject: {}, isPinned: true, isPending: true,
        onRefresh: async () => {}
    });
    assert.equal(container.children.length, 1);
    const card = container.children[0];
    assert.match(card.className, /pinned/);
    assert.equal(card.children[1].children[1].textContent, "Loading...");
    assert.equal(card.children[2].children[0].textContent, "Loading...");
});

test("real fresh data preserves the original online and logtime display", () => {
    const container = new MockElement("section");
    createFriendItem({
        container, friend: "bob", today: "2026-10-27",
        friendObject: { location: "z1r2p3" },
        logTimeObject: { "2026-10-27": "04:30" },
        isPinned: false,
        onRefresh: async () => {}
    });
    assert.equal(container.children.length, 1);
    assert.equal(container.children[0].children[1].children[1].textContent, "04h30 today");
    assert.equal(container.children[0].children[2].children[0].textContent, "z1r2p3");
});
