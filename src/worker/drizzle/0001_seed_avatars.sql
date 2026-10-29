-- 0001_seed_avatars.sql
--
-- Seeds the unchanged buddy roster (8 avatars x 5 stages) and the single
-- content_meta row. Vocabulary rows are authored by feature 17 as reviewed
-- migrations; this file adds no topic, pack, or word.

INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('alex', 'Alex', 'Alex', '#3b6fd4', '#d9e4ff', '1');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('cody', 'Cody', 'Cody', '#d9732f', '#ffe3cf', '2');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('creeper', 'Creeper', 'Creeper', '#3f9b4a', '#d4f0d6', '3');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('malenia', 'Malenia', 'Malenia', '#a84b4b', '#f5d9d7', '4');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('may', 'May', 'May', '#c65b8a', '#ffe0ec', '5');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('radahn', 'Radahn', 'Radahn', '#b8863b', '#f6e7c9', '6');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('steve', 'Steve', 'Steve', '#5b6f9b', '#dde5f3', '7');
INSERT INTO avatars (id, name, name_zh, color, pale, sort_order) VALUES ('warden', 'Warden', 'Warden', '#3e5c74', '#dbe6ee', '8');

INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('alex', 'egg', 'art/avatars/alex.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('alex', 'hatchling', 'art/avatars/alex.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('alex', 'juvenile', 'art/avatars/alex.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('alex', 'adult', 'art/avatars/alex.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('alex', 'legendary', 'art/avatars/alex.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('cody', 'egg', 'art/avatars/cody.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('cody', 'hatchling', 'art/avatars/cody.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('cody', 'juvenile', 'art/avatars/cody.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('cody', 'adult', 'art/avatars/cody.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('cody', 'legendary', 'art/avatars/cody.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('creeper', 'egg', 'art/avatars/creeper.jpg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('creeper', 'hatchling', 'art/avatars/creeper.jpg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('creeper', 'juvenile', 'art/avatars/creeper.jpg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('creeper', 'adult', 'art/avatars/creeper.jpg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('creeper', 'legendary', 'art/avatars/creeper.jpg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('malenia', 'egg', 'art/avatars/malenia.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('malenia', 'hatchling', 'art/avatars/malenia.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('malenia', 'juvenile', 'art/avatars/malenia.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('malenia', 'adult', 'art/avatars/malenia.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('malenia', 'legendary', 'art/avatars/malenia.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('may', 'egg', 'art/avatars/may.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('may', 'hatchling', 'art/avatars/may.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('may', 'juvenile', 'art/avatars/may.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('may', 'adult', 'art/avatars/may.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('may', 'legendary', 'art/avatars/may.png');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('radahn', 'egg', 'art/avatars/radahn.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('radahn', 'hatchling', 'art/avatars/radahn.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('radahn', 'juvenile', 'art/avatars/radahn.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('radahn', 'adult', 'art/avatars/radahn.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('radahn', 'legendary', 'art/avatars/radahn.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('steve', 'egg', 'art/avatars/steve.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('steve', 'hatchling', 'art/avatars/steve.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('steve', 'juvenile', 'art/avatars/steve.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('steve', 'adult', 'art/avatars/steve.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('steve', 'legendary', 'art/avatars/steve.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('warden', 'egg', 'art/avatars/warden.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('warden', 'hatchling', 'art/avatars/warden.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('warden', 'juvenile', 'art/avatars/warden.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('warden', 'adult', 'art/avatars/warden.jpeg');
INSERT INTO avatar_stages (avatar_id, stage, file) VALUES ('warden', 'legendary', 'art/avatars/warden.jpeg');

INSERT INTO content_meta (id, schema_version, dataset, content_version) VALUES (1, 1, 'dev', '0.3.0');
