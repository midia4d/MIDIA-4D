-- ==============================================================
-- ACADEMIA MÍDIA 4D - 00: WIPEOUT TOTAL 💥
-- Este script apaga TODAS as tabelas, funções e políticas do public.
-- ==============================================================

-- 1. Zera o Schema Inteiro
DROP SCHEMA public CASCADE;

-- 2. Recria o Schema Limpo
CREATE SCHEMA public;

-- 3. Devolve as Permissões Padrão para o Supabase conseguir usar
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- ==============================================================
-- ⚠️ ATENÇÃO MÁXIMA ANTES DE CONTINUAR:
-- Este script APAGA os dados das tabelas, mas NÃO APAGA as contas
-- de E-mail/Senha que ficam escondidas no cofre do Supabase (auth.users).
-- 
-- PARA ZERAR O SISTEMA 100%:
-- Vá no Menu lateral Esquerdo do Supabase (Ícone de Cadeado/Authentication)
-- Clique em "Users", Selecione todos os e-mails e clique em "Delete".
-- SÓ DEPOIS DISSO VOCÊ DEVE RODAR O ARQUIVO `01_MASTER_INSTALL.sql`.
-- ==============================================================
