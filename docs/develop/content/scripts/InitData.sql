-- InitData.sql
--
-- Seeds the vocabulary from docs/develop/content/{topics,packs,words}.json
-- into the tables created by src/worker/drizzle/0000_content_schema.sql.
--
-- Scope: only the topics whose word rows exist in words.json are seeded.
-- puzzle-and-mystery is omitted with its packs: packs.json lists word ids that words.json does not define,
-- co-op-quest is omitted with its packs: packs.json lists word ids that words.json does not define,
-- battle-and-survive is omitted with its packs: packs.json lists word ids that words.json does not define,
-- and pack_words requires every word to exist. Add them when their vocabulary is authored.
--
-- image is NULL: the JSON paths (art/*.webp) point at bundled files that no
-- longer ship, and the API expects a URL. The client falls back to emoji.
--
-- Re-runnable: INSERT OR REPLACE refreshes rows instead of colliding.
--
-- Local use, from src/:
--   pnpm exec wrangler d1 execute DB --local --config worker/wrangler.jsonc \
--     --file=../docs/develop/content/InitData.sql

-- Topics -------------------------------------------------------------
INSERT OR REPLACE INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at) VALUES ('craft-and-build', 'Craft & Build', '手工与建造', '🔨', 'Make things, fix things, and build amazing stuff.', '动手做东西、修东西，建造属于你的世界。', 1, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at) VALUES ('explore-and-discover', 'Explore & Discover', '探索与发现', '🧭', 'Find hidden places and learn about the world.', '寻找隐藏的地方，认识我们的世界。', 2, 1793836800000, 1793836800000);

-- Packs --------------------------------------------------------------
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('craft-1', 'craft-and-build', 'My Workshop', '我的工作间', 1, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('craft-2', 'craft-and-build', 'Materials & Making', '材料与动手', 2, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('craft-3', 'craft-and-build', 'Making & Feeling', '动手与心情', 3, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('explore-1', 'explore-and-discover', 'Wild Places', '野外地方', 1, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('explore-2', 'explore-and-discover', 'Finding the Way', '找路', 2, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('explore-3', 'explore-and-discover', 'Curious Minds', '好奇的心', 3, 1793836800000, 1793836800000);

-- Pack membership ---------------------------------------------------
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-box', 1);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-bag', 2);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-paper', 3);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-pencil', 4);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-ruler', 5);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-crayon', 6);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-paint', 7);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-toy', 8);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-ball', 9);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-clock', 10);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-desk', 11);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-table', 12);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-chair', 13);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-lamp', 14);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-make', 15);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-draw', 16);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-choose', 17);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-build', 18);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-fix', 19);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-1', 'w-careful', 20);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-sand', 1);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-glass', 2);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-bottle', 3);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-bowl', 4);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-net', 5);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-plastic', 6);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-metal', 7);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-wood', 8);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-wool', 9);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-gold', 10);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-silver', 11);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-stone', 12);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-scissors', 13);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-glue', 14);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-brush', 15);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-repair', 16);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-safe', 17);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-strong', 18);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-easy', 19);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-2', 'w-difficult', 20);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-cut', 1);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-design', 2);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-invent', 3);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-collect', 4);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-prepare', 5);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-decide', 6);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-believe', 7);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-explain', 8);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-improve', 9);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-together', 10);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-happy', 11);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-excited', 12);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-worried', 13);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-brave', 14);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-clever', 15);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-kind', 16);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-friendly', 17);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-beautiful', 18);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-important', 19);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('craft-3', 'w-ready', 20);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-01', 1);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-02', 2);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-03', 3);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-04', 4);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-05', 5);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-06', 6);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-07', 7);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-08', 8);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-09', 9);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-10', 10);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-11', 11);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-12', 12);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-13', 13);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-14', 14);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-15', 15);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-16', 16);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-17', 17);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-18', 18);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-19', 19);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-1', 'w-explore-1-20', 20);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-01', 1);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-02', 2);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-03', 3);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-04', 4);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-05', 5);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-06', 6);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-07', 7);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-08', 8);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-09', 9);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-10', 10);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-11', 11);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-12', 12);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-13', 13);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-14', 14);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-15', 15);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-16', 16);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-17', 17);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-18', 18);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-19', 19);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-2', 'w-explore-2-20', 20);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-01', 1);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-02', 2);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-03', 3);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-04', 4);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-05', 5);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-06', 6);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-07', 7);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-08', 8);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-09', 9);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-10', 10);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-11', 11);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-12', 12);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-13', 13);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-14', 14);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-15', 15);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-16', 16);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-17', 17);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-18', 18);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-19', 19);
INSERT OR REPLACE INTO pack_words (pack_id, word_id, position) VALUES ('explore-3', 'w-explore-3-20', 20);

-- Content metadata --------------------------------------------------
-- Bumped from 0001's 0.3.0 so the ETag and /health reflect the new rows.
INSERT OR REPLACE INTO content_meta (id, schema_version, dataset, content_version) VALUES (1, 1, 'dev', '0.4.0');
