ALTER TABLE investors
ADD COLUMN aum TEXT;


ALTER TABLE investors
ADD COLUMN buy_sell_side TEXT;


ALTER TABLE users
ADD COLUMN mapped_customers UUID[] DEFAULT '{}';