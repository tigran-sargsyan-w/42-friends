import test from "node:test";
import assert from "node:assert/strict";

class Element {
    constructor(name) {
        this.tagName = name.toUpperCase();
        this.className = "";
        this.children = [];
        this.style = {};
        this.textContent = "";
        this.scrollTop = 0;
        this.isConnected = true;
        this.classList = { add: value => { this.className += " " + value; } };
    }
    appendChild(node) { this.children.push(node); node.parent = this; return node; }
    insertBefore(node, before) {
        const idx = this.children.indexOf(before);
        if (idx === -1) return this.appendChild(node);
        this.children.splice(idx, 0, node);
        node.parent = this;
        return node;
    }
    replaceChildren(...nodes) {
        this.children.forEach(node => { node.parent = null; });
        this.children = [];
        nodes.forEach(node => this.appendChild(node));
    }
    querySelector(selector) {
        return this.children.find(node => selector.startsWith(".") &&
            node.className.split(" ").includes(selector.slice(1))) || null;
    }
    addEventListener() {}
    remove() {
        if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);
    }
}
const local = new Map();
const sync = new Map();
sync.set("friend_list", ["alice", "bob"]);
sync.set("pinned_friends", ["alice"]);
for (const [login, location] of [["alice", "z1r1p1"], ["bob", null]]) {
    local.set("friend_cache_" + login, {
        data: {
            friend: login,
            friend_object: { login, location, image: { link: "https://example.org/" + login + ".jpg" } },
            log_time_object: {}
        },
        timestamp: Date.now()
    });
}
const store = map => ({
    async get(keys) {
        const output = {};
        for (const key of (keys === null ? [...map.keys()] : Array.isArray(keys) ? keys : [keys])) {
            if (map.has(key)) output[key] = map.get(key);
        }
        return output;
    },
    async set(values) {
        for (const [key, value] of Object.entries(values)) map.set(key, value);
    },
    async remove(key) { map.delete(key); }
});
globalThis.chrome = { storage: { local: store(local), sync: store(sync) } };
globalThis.document = {
    createElement: name => new Element(name),
    body: new Element("body"),
    querySelectorAll: () => []
};
globalThis.window = { open() {}, innerWidth: 1400, innerHeight: 900 };

const { renderFriendsList } = await import("../src/content/ui/friends-list.js");

test("renders cached pinned and regular friends immediately without network calls", async () => {
    globalThis.fetch = async () => { throw Error("No fetch should occur for a fresh cache"); };
    const container = new Element("section");
    await renderFriendsList(container, "Alphabetical (A-Z)", async () => {});
    assert.equal(container.children.length, 1);
    const list = container.children[0];
    assert.equal(list.className, "tf-friends-list-scroll");
    const cards = list.children.filter(node => node.className.includes("tf-friend-item"));
    assert.equal(cards.length, 2);
    assert.match(cards[0].className, /pinned/);
    assert.equal(cards[0].children[2].children[0].textContent, "z1r1p1");
    assert.equal(cards[1].children[2].children[0].textContent, "Offline");
    assert.match(cards[0].children[0].style.backgroundImage, /alice.jpg/);
});
