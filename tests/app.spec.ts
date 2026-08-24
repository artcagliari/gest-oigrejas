import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/");
});

test("login mostra senha e abre o painel", async ({ page }) => {
  const password = page.getByLabel("Senha", { exact: true });
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(
    page.getByRole("heading", { name: /Vamos cuidar da comunidade/ }),
  ).toBeVisible();
});

test("Administrador da Plataforma vê somente igrejas e cria o Gestor Geral", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Superusuário" }).click();
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page.getByRole("heading", { name: "Igrejas" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Pessoas", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Financeiro", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Nova igreja" }).click();
  await page.getByLabel("Nome da igreja").fill("Igreja Teste");
  await page
    .getByLabel("Nome completo do Gestor Geral")
    .fill("Gestor da Igreja");
  await page
    .getByLabel("E-mail de acesso do Gestor Geral")
    .fill("gestor@igrejateste.org");
  await page
    .getByLabel("Senha provisória do Gestor Geral")
    .fill("SenhaTeste2026!");
  await page.getByRole("button", { name: "Mostrar senha provisória" }).click();
  await expect(
    page.getByLabel("Senha provisória do Gestor Geral"),
  ).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByText("Igreja e acesso do Gestor Geral criados."),
  ).toBeVisible();
});

test("cadastra e abre uma ficha aprofundada", async ({ page }) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  await page.getByRole("button", { name: "Nova pessoa" }).click();
  await page.getByLabel("Nome completo").fill("Pessoa de Teste");
  await page.getByLabel("Telefone principal").fill("(11) 99999-0000");
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("checkbox", { name: "Membro", exact: true }).click();
  await page
    .locator("label.check-card")
    .filter({ hasText: "Consolidação Essencial" })
    .click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByText("Privacidade por padrão")).toBeVisible();
  await page.locator(".consent-form input").first().check();
  await page.getByRole("button", { name: /Salvar pessoa/ }).click();
  await expect(page.getByText("Pessoa cadastrada.")).toBeVisible();
  await page.getByText("Pessoa de Teste", { exact: true }).click();
  await expect(page.getByText("FICHA DA PESSOA")).toBeVisible();
  await page.getByRole("button", { name: "Vida na igreja" }).click();
  await expect(
    page.getByText("Consolidação Essencial", { exact: true }),
  ).toBeVisible();
});

test("abre cadastros de ensino, agenda e financeiro", async ({ page }) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Ensino", exact: true }).click();
  await page.getByRole("button", { name: "Novo grupo" }).click();
  await expect(
    page.getByRole("heading", { name: "Novo grupo de ensino" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Agenda", exact: true }).click();
  await page.getByRole("button", { name: "Lista" }).click();
  await expect(page.getByText("Culto de celebração")).toBeVisible();
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByRole("button", { name: "Nova", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Nova conta" })).toBeVisible();
});

test("Gestor Geral define líder e participantes do grupo de ensino", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Ensino", exact: true }).click();
  const group = page.locator(".group-card").filter({
    hasText: "Consolidação Essencial",
  });
  await group.getByRole("button", { name: /Gerenciar turma/ }).click();
  await expect(
    page.getByRole("heading", { name: "Gerenciar grupo de ensino" }),
  ).toBeVisible();
  await page
    .locator("label.check-card")
    .filter({ hasText: "Clara Souza" })
    .click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Grupo atualizado.")).toBeVisible();
  await group.getByRole("button", { name: /Ver participantes/ }).click();
  await expect(group.getByText("Clara Souza")).toBeVisible();
});

test("Gestor Geral exclui departamento com confirmação", async ({ page }) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page
    .getByRole("button", { name: "Departamentos", exact: true })
    .click();
  await expect(
    page.getByText("Ministério de Louvor", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir Ministério de Louvor" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Excluir departamento" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Excluir departamento" }).click();
  await expect(page.getByText("Departamento excluído.")).toBeVisible();
  await expect(
    page.getByText("Ministério de Louvor", { exact: true }),
  ).toHaveCount(0);
});

test("Gestor Geral atribui cargo e liderança no departamento", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page
    .getByRole("button", { name: "Departamentos", exact: true })
    .click();
  const louvor = page.locator(".department-card").filter({
    hasText: "Ministério de Louvor",
  });
  await louvor
    .getByRole("button", { name: /Gerenciar equipe e cargos/ })
    .click();
  await page
    .locator("label.check-card")
    .filter({ hasText: "Clara Souza" })
    .click();
  await page
    .getByLabel("Cargo de Clara Souza")
    .selectOption({ label: "Músico(a)" });
  const claraAssignment = page
    .locator(".department-assignments > div")
    .filter({ hasText: "Clara Souza" });
  await claraAssignment
    .getByRole("checkbox", { name: "Pode gerenciar" })
    .check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Departamento atualizado.")).toBeVisible();
  await expect(louvor.getByText("Clara Souza")).toBeVisible();
  await expect(louvor.getByText(/Músico\(a\).*Líder gestor/)).toBeVisible();
});

test("registra autorização infantil específica e check-in do culto", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Kids", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kids" })).toBeVisible();
  await expect(page.getByText("Sofia Ribeiro", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Registrar" }).click();
  await page
    .getByRole("checkbox", { name: "Fotografia durante o culto" })
    .check();
  await page.getByRole("checkbox", { name: "Gravação em vídeo" }).check();
  await page
    .getByLabel("Nome completo do responsável que manifestou a decisão")
    .fill("Mariana Ribeiro");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByText("Decisão do responsável registrada."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Check-in e saída" }).click();
  await page.getByRole("button", { name: "Fazer check-in" }).click();
  await expect(
    page.getByRole("heading", { name: "Check-in da criança" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Entrada da criança registrada.")).toBeVisible();
  await expect(page.getByText(/Presente desde/)).toBeVisible();
});

test("responsável responde autorização pelo link público", async ({ page }) => {
  await page.goto("/?authorization=11111111-1111-4111-8111-111111111111");
  await expect(
    page.getByText("AUTORIZAÇÃO ESPECÍFICA POR CULTO"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Não autorizar" }).click();
  await page
    .getByLabel("Nome completo do pai, mãe ou responsável legal")
    .fill("Mariana Ribeiro");
  await page.getByRole("button", { name: /Registrar decisão/ }).click();
  await expect(
    page.getByRole("heading", { name: "Decisão registrada" }),
  ).toBeVisible();
});

test("membro faz pré-cadastro pelo link e já fica vinculado à igreja", async ({
  page,
}) => {
  await page.goto("/?cadastro=22222222-2222-4222-8222-222222222222");
  await expect(
    page.getByRole("heading", { name: "Vamos conhecer você" }),
  ).toBeVisible();
  await expect(page.getByText("Igreja da Promessa").first()).toBeVisible();
  await page.getByLabel("Nome completo").fill("Rafael do Cadastro");
  await page.getByLabel("Data de nascimento").fill("1994-03-12");
  await page.getByLabel("Telefone principal").fill("(11) 98888-7766");
  await page.getByLabel("E-mail").fill("rafael.cadastro@exemplo.org");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page
    .getByRole("checkbox", {
      name: /Autorizo o tratamento dos meus dados pessoais/,
    })
    .check();
  await page.getByRole("button", { name: "Enviar meu cadastro" }).click();
  await expect(
    page.getByRole("heading", { name: "Seja bem-vindo(a)!" }),
  ).toBeVisible();

  const savedPerson = await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("comunhao-workspace-v2") ?? "{}",
    );
    return workspace.people?.find(
      (person: { full_name: string }) =>
        person.full_name === "Rafael do Cadastro",
    );
  });
  expect(savedPerson.church_id).toBe("demo-church");
  expect(savedPerson.categories).toContain("Pré-cadastro");
  expect(savedPerson.consent.data_processing).toBe(true);
});
