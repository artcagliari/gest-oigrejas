# Comunhão — gestão completa para igrejas

Sistema multi-igreja com Administrador da Plataforma isolado e Gestores Gerais por igreja, pessoas com ficha aprofundada, Kids, ensino, departamentos, agenda e financeiro. A aplicação usa React/TypeScript e Supabase (Auth, PostgreSQL, RLS e Edge Functions).

## Módulos implementados

- login real, recuperação de senha, mostrar/ocultar senha e erros em português;
- Administrador da Plataforma restrito ao painel e à criação de igrejas;
- criação da igreja junto com o convite do Gestor Geral;
- equipe com cargos `super`, pessoas, ensino, financeiro, agenda e consulta;
- pessoas com dados pessoais, endereço, categorias, funções, grupos, jornada espiritual e anotações;
- link público de pré-cadastro por igreja, com validade, vínculo automático e prevenção de duplicidade;
- campos opcionais no cadastro interno e público, com consentimentos apresentados na ficha impressa para assinatura;
- consulta de CPF pelo Hub do Desenvolvedor, preenchendo nome e nascimento sem expor a chave no frontend;
- consulta de CEP pelo ViaCEP, com preenchimento de rua, bairro, cidade e estado sem alterar número ou complemento;
- jornada com batismo, categoria Adolescente e histórico permanente de entrada e saída dos grupos;
- grupos de consolidação/ensino, liderança, capacidade, aulas e chamada individual;
- departamentos com modelos, descrição e cargos próprios;
- agenda mensal/lista, tipos de evento e criação de cultos;
- financeiro com contas, categorias, receitas, despesas, vencimentos, baixas, saldo e indicadores;
- Kids com criança, responsável legal, saúde, retirada autorizada, check-in e check-out;
- autorização de imagem **nova para cada culto**, com foto, vídeo e redes sociais separados, link público, impressão e auditoria.

## Executar

```bash
npm install
npm run dev
```

Copie `.env.example` para `.env.local` e informe a URL e a chave anônima. No SQL Editor, execute nesta ordem:

1. `supabase/schema.sql`
2. `supabase/migration_v2.sql`
3. `supabase/migration_v3_complete.sql`
4. `supabase/migration_v5_platform_separation.sql`
5. `supabase/migration_v6_department_leaders.sql`
6. `supabase/migrations/20260824223000_teaching_group_leaders.sql`
7. `supabase/migrations/20260824224500_teaching_group_roles.sql`
8. `supabase/migrations/20260824230000_church_self_registration.sql`
9. `supabase/migrations/20260824233000_person_required_fields.sql`
10. `supabase/migrations/20260824234000_person_gender_values.sql`
11. `supabase/migrations/20260824235000_person_address_complement.sql`
12. `supabase/migrations/20260824242000_person_journey_history.sql`
13. `supabase/seed.sql`

O seed não cria dados fictícios nem igrejas. Ele transforma o único usuário existente no Auth em Administrador da Plataforma. Por segurança, ele para com erro se houver zero ou mais de um usuário.

## Primeiro login Master

Crie apenas o usuário administrador em Supabase > Authentication > Users e execute `supabase/seed.sql`. Depois, saia e entre novamente. Essa conta verá somente o painel de igrejas. Ao cadastrar uma igreja, informe nome, e-mail e senha provisória do Gestor Geral. As credenciais são criadas imediatamente e dão acesso total somente àquela igreja.

Para habilitar **Convidar usuário**, publique a função:

```bash
supabase functions deploy create-church
supabase functions deploy invite-user
supabase functions deploy lookup-cpf
```

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` pertencem ao ambiente das funções. A `service_role` nunca deve ser colocada no frontend.

Cadastre a chave do Hub do Desenvolvedor como segredo do backend antes de
publicar a consulta de CPF:

```bash
supabase secrets set HUB_DESENVOLVEDOR_TOKEN=SUA_CHAVE
```

## Fluxo Kids e autorização

Ao criar um evento do tipo **Culto** na Agenda, mantenha marcada a opção de autorização. O banco cria uma pendência por criança. No Kids, copie o link individual, imprima ou registre a manifestação presencial, confira o escopo e faça o check-in. A recusa não impede a participação.

Cada autorização guarda texto, versão, culto, criança, responsável, data, decisão e escopos. Alterações entram em `child_authorization_audit`. Um culto posterior sempre recebe outra autorização; a decisão antiga não é reaproveitada.

## Link de cadastro da igreja

Em **Pessoas**, use **Gerar e copiar link**. O endereço público vale por 90 dias e pode ser enviado por WhatsApp ou e-mail. O membro informa os dados pessoais, contato, endereço, vida cristã e consentimentos sem receber acesso administrativo. A ficha entra na igreja correta com a categoria **Pré-cadastro** para revisão do Gestor Geral.

Ao informar um CEP com oito dígitos e sair do campo, o sistema consulta o ViaCEP. Também é possível usar o botão **Buscar**. Rua, bairro, cidade e estado permanecem editáveis; número e complemento são sempre informados manualmente.

## Modelo de segurança

Todos os registros operacionais possuem `church_id`. O Administrador da Plataforma não recebe vínculo operacional e não pode ler Pessoas, Kids, Ensino, Agenda, Departamentos ou Financeiro. O Gestor Geral recebe `super` somente na igreja criada. As políticas RLS isolam dados por igreja e limitam escrita por cargo. O link público usa token UUID imprevisível e expõe apenas os dados necessários à decisão; informações médicas ficam autenticadas.

Antes do uso real, revise o texto, retenção, canal de revogação e política de privacidade com o responsável jurídico/encarregado da igreja.

## Verificação

```bash
npm run lint
npm run build
npm run test:e2e
```

Os testes usam `VITE_FORCE_DEMO=true`, sem alterar o Supabase conectado em `.env.local`.
