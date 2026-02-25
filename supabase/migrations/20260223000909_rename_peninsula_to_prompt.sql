-- Rename founding organisation from "Peninsula Accounting" to "Prompt"
-- Updates both the display name and slug

UPDATE organisations
SET name = 'Prompt',
    slug = 'prompt'
WHERE slug = 'peninsula';
