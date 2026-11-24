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
INSERT OR REPLACE INTO topics (id, title, title_zh, icon, description, description_zh, sort_order, created_at, updated_at) VALUES ('grade-3-a', 'Grade 3-A', '三年级上', '🏫', 'Words in grade 3-A.', '三年级上册学校单词', 3, 1794899174954, 1794899187049);

-- Packs --------------------------------------------------------------
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('craft-1', 'craft-and-build', 'My Workshop', '我的工作间', 1, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('craft-2', 'craft-and-build', 'Materials & Making', '材料与动手', 2, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('craft-3', 'craft-and-build', 'Making & Feeling', '动手与心情', 3, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('explore-1', 'explore-and-discover', 'Wild Places', '野外地方', 1, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('explore-2', 'explore-and-discover', 'Finding the Way', '找路', 2, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES ('explore-3', 'explore-and-discover', 'Curious Minds', '好奇的心', 3, 1793836800000, 1793836800000);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-1','grade-3-a','3A01','3A01',1,1794899273332,1794899747101);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-2','grade-3-a','3A02','3A02',2,1794910283469,1794910394690);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-3','grade-3-a','3A03','3A03',3,1794910413658,1794910615945);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-4','grade-3-a','3A04','3A04',4,1794910628600,1794910922879);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-5','grade-3-a','3A05','3A05',5,1794910946761,1794911028976);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-6','grade-3-a','3A06','3A06',6,1794911228864,1794911332470);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-7','grade-3-a','3A07','3A07',7,1794911426950,1794911502529);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-8','grade-3-a','3A08','3A08',8,1794911543455,1794911590122);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-9','grade-3-a','3A09','3A09',9,1794962735339,1794962812891);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-10','grade-3-a','3A10','3A10',10,1794962829783,1794962884569);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-11','grade-3-a','3A11','3A11',11,1794962898051,1794962946547);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-12','grade-3-a','3A12','3A12',12,1794962963899,1794963021015);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-13','grade-3-a','3A13','3A13',13,1794963042883,1794963106363);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-14','grade-3-a','3A14','3A14',14,1794963143738,1794963219396);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-15','grade-3-a','3A15','3A15',15,1794963254555,1794963297536);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-16','grade-3-a','3A16','3A16',16,1794963315106,1794963354712);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-17','grade-3-a','3A17','3A17',17,1794963372039,1794963413728);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-18','grade-3-a','3A18','3A18',18,1794963435995,1794963547198);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-19','grade-3-a','3A19','3A19',19,1794963569259,1794963712328);
INSERT OR REPLACE INTO packs (id, topic_id, title, title_zh, sort_order, created_at, updated_at) VALUES('grade-3-a-20','grade-3-a','3A20','3A20',20,1794963624185,1794963685110);

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
