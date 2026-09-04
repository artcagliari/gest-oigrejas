import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.route("https://viacep.com.br/ws/**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        cep: "01000-000",
        logradouro: "Rua preenchida pelo CEP",
        complemento: "Apto 10",
        bairro: "Centro",
        localidade: "São Paulo",
        uf: "SP",
      }),
    });
  });
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
  await page.getByRole("checkbox", { name: "Membro", exact: true }).check();
  await expect(page.getByLabel("Escolaridade")).not.toHaveAttribute(
    "required",
    "",
  );
  await page.getByLabel("Nome completo").fill("Pessoa de Teste");
  await page.getByLabel("Data de nascimento").fill("10/05/1990");
  await page.getByLabel("Sexo").selectOption("Homem");
  await page.getByLabel("Escolaridade").selectOption("Ensino Médio");
  await page.getByLabel("Estado civil").selectOption("Solteiro(a)");
  await page.getByLabel("CPF").fill("123.456.789-01");
  await page.getByLabel("Possui filhos?").selectOption("Sim");
  await page.getByLabel("Nome completo do filho 1").fill("Sandra Cadastro");
  await page.getByLabel("Data de nascimento do filho 1").fill("10/04/1998");
  await page.getByLabel("CPF do filho 1").fill("111.456.789-01");
  await page.getByLabel("Sexo do filho 1").selectOption("Mulher");
  await page.getByRole("button", { name: "Adicionar outro filho" }).click();
  await page.getByLabel("Nome completo do filho 2").fill("Helena Cadastro");
  await page.getByLabel("Data de nascimento do filho 2").fill("22/09/2012");
  await page.getByLabel("CPF do filho 2").fill("222.456.789-02");
  await page.getByLabel("Sexo do filho 2").selectOption("Mulher");
  await page.getByLabel("Telefone WhatsApp").fill("11999990000");
  await expect(page.getByLabel("Telefone WhatsApp")).toHaveValue(
    "(11) 99999-0000",
  );
  await page.getByLabel("E-mail").fill("pessoa.teste@exemplo.org");
  await page.getByLabel("Endereço").fill("Rua de Teste");
  await page.getByLabel("Número").fill("100");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("CEP").fill("01000-000");
  await page.getByLabel("Complemento").fill("Casa");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByRole("textbox", { name: /^Estado/ }).fill("SP");
  await page.getByLabel("É batizado(a)?").selectOption("yes");
  await page.getByLabel("Data do batismo").fill("2021-02-14");
  await expect(page.getByText("Privacidade por padrão")).toHaveCount(0);
  await page.getByRole("button", { name: /Salvar pessoa/ }).click();
  await expect(page.getByText("Pessoa cadastrada.")).toBeVisible();
  const internalFamily = await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("comunhao-workspace-v2") ?? "{}",
    );
    const parent = workspace.people.find(
      (person: { full_name: string }) => person.full_name === "Pessoa de Teste",
    );
    const children = workspace.people.filter((person: { full_name: string }) =>
      ["Sandra Cadastro", "Helena Cadastro"].includes(person.full_name),
    );
    return {
      parent,
      children,
      guardians: workspace.guardians.filter(
        (guardian: { guardian_person_id: string }) =>
          guardian.guardian_person_id === parent.id,
      ),
    };
  });
  expect(internalFamily.children).toHaveLength(2);
  expect(internalFamily.children[0].consent).toEqual(
    internalFamily.parent.consent,
  );
  expect(internalFamily.children[0].address).toEqual(
    internalFamily.parent.address,
  );
  expect(
    internalFamily.children.find(
      (child: { full_name: string }) => child.full_name === "Sandra Cadastro",
    ).categories,
  ).toEqual(["Membro"]);
  expect(internalFamily.guardians).toHaveLength(1);
  await page.getByRole("button", { name: "Nova pessoa" }).click();
  await page.getByLabel("Possui filhos?").selectOption("Sim");
  await page.getByLabel("CPF do filho 1").fill("222.456.789-02");
  await expect(page.getByLabel("Nome completo do filho 1")).toHaveValue(
    "Helena Cadastro",
  );
  await expect(page.getByLabel("Data de nascimento do filho 1")).toHaveValue(
    "22/09/2012",
  );
  await expect(page.getByLabel("Sexo do filho 1")).toHaveValue("Mulher");
  await page.getByRole("button", { name: "Cancelar" }).click();
  await page.getByRole("button", { name: "Ensino", exact: true }).click();
  const consolidation = page.locator(".group-card").filter({
    hasText: "Consolidação Essencial",
  });
  await consolidation.getByRole("button", { name: /Gerenciar turma/ }).click();
  await page
    .getByLabel("Pesquisar pessoa para integrar a turma")
    .fill("Pessoa de Teste");
  await page
    .locator("label.check-card")
    .filter({ hasText: "Pessoa de Teste" })
    .click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  await page.getByText("Pessoa de Teste", { exact: true }).click();
  await expect(page.getByText("FICHA DA PESSOA")).toBeVisible();
  const printPagePromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Imprimir ficha para assinatura" })
    .click();
  const printPage = await printPagePromise;
  await expect(
    printPage.getByText("Consentimento para dados da vida eclesiástica"),
  ).toBeVisible();
  await expect(printPage.getByText(/AUTORIZO/).first()).toBeVisible();
  await page
    .getByRole("button", { name: "Informações e vida na igreja" })
    .click();
  await expect(
    page.getByText("Consolidação Essencial", { exact: true }),
  ).toHaveCount(3);
  const updatedPrintPagePromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "Imprimir ficha para assinatura" })
    .click();
  const updatedPrintPage = await updatedPrintPagePromise;
  await expect(
    updatedPrintPage.getByText(/Consolidação Essencial/),
  ).toBeVisible();
  const teachingGroupsCard = page.locator(".info-card").filter({
    has: page.getByRole("heading", { name: "Grupos de ensino", exact: true }),
  });
  await expect(teachingGroupsCard.getByText(/Cargo: Aluno\(a\)/)).toBeVisible();
  const teachingHistoryCard = page.locator(".info-card").filter({
    has: page.getByRole("heading", {
      name: "Histórico de grupos de ensino",
    }),
  });
  await expect(teachingHistoryCard.getByText(/Entrou no grupo/)).toBeVisible();
});

test("cadastra visitante sem solicitar consentimentos no formulário", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  await page.getByRole("button", { name: "Nova pessoa" }).click();

  const form = page.locator(".modal-layer form");
  await expect(form.locator(".form-section").first()).toContainText(
    "Vínculo com a igreja",
  );
  await form.getByRole("checkbox", { name: "Visitante", exact: true }).check();
  await expect(form.getByLabel("CPF")).toHaveCount(0);
  await expect(form.getByLabel("Data de nascimento")).toHaveCount(0);
  await expect(form.getByLabel("E-mail")).toHaveCount(0);
  await expect(form.getByLabel("Possui filhos?")).toHaveCount(0);

  await form.getByLabel("Nome completo").fill("Visitante Interno");
  await form.getByLabel("Telefone WhatsApp").fill("11966665555");
  await expect(form.locator(".consent-form input")).toHaveCount(0);
  await form.getByRole("button", { name: /Salvar pessoa/ }).click();
  await expect(page.getByText("Pessoa cadastrada.")).toBeVisible();

  const visitor = await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("comunhao-workspace-v2") ?? "{}",
    );
    return workspace.people.find(
      (person: { full_name: string }) =>
        person.full_name === "Visitante Interno",
    );
  });
  expect(visitor.categories).toEqual(["Visitante"]);
  expect(visitor.phone_primary).toBe("(11) 96666-5555");
  expect(visitor.document_cpf).toBeUndefined();
  expect(visitor.email).toBeUndefined();
  expect(visitor.birth_date).toBeUndefined();
  expect(visitor.consent.data_processing).toBe(false);
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
  await page
    .getByRole("button", { name: "Editar Culto de celebração" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Editar compromisso" }),
  ).toBeVisible();
  await expect(page.getByLabel("Título")).toHaveValue("Culto de celebração");
  await expect(page.getByLabel("Início")).toHaveValue("19:00");
  await page.getByLabel("Local").fill("Templo principal");
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Compromisso atualizado.")).toBeVisible();
  await expect(page.getByText(/Templo principal/)).toBeVisible();
  const savedEventStartsAt = await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("comunhao-workspace-v2") ?? "{}",
    );
    return workspace.events.find(
      (event: { title: string }) => event.title === "Culto de celebração",
    ).starts_at as string;
  });
  expect(savedEventStartsAt).toMatch(/Z$/);
  expect(
    await page.evaluate(
      (startsAt) => new Date(startsAt).getHours(),
      savedEventStartsAt,
    ),
  ).toBe(19);
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.getByRole("button", { name: "Nova", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Nova conta" })).toBeVisible();
});

test("Gestor Geral exclui uma pessoa e seus vínculos", async ({ page }) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  await page.getByText("Lucas Almeida", { exact: true }).click();
  await page.getByRole("button", { name: "Excluir pessoa" }).click();
  await expect(
    page.getByRole("heading", { name: "Excluir “Lucas Almeida”?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Excluir pessoa definitivamente" })
    .click();
  await expect(
    page.getByText("Pessoa excluída com seus vínculos."),
  ).toBeVisible();
  await expect(page.getByText("Lucas Almeida", { exact: true })).toHaveCount(0);
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
    .getByLabel("Pesquisar pessoa para integrar a turma")
    .fill("Clara Souza");
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
  await page.getByRole("button", { name: "Novo departamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Criar novo departamento" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Usar modelo Louvor" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Criar departamento personalizado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Usar modelo Louvor" }).click();
  await expect(page.getByLabel("Nome do departamento")).toHaveValue("Louvor");
  await expect(page.getByLabel("Modelo")).toHaveValue("worship");
  await expect(page.locator('input[value="Regente / maestro(a)"]')).toHaveCount(
    1,
  );
  await page.getByLabel("Novo cargo ou função").fill("Compositor(a)");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.locator('input[value="Compositor(a)"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Cancelar" }).click();
  const louvor = page.locator(".department-card").filter({
    hasText: "Ministério de Louvor",
  });
  await louvor
    .getByRole("button", { name: /Gerenciar equipe e cargos/ })
    .click();
  await page
    .getByRole("searchbox", { name: "Buscar participante pelo nome" })
    .fill("Clara Souza");
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
  const assignmentBox = await claraAssignment.boundingBox();
  const removeBox = await claraAssignment
    .getByRole("button", { name: "Remover Clara Souza" })
    .boundingBox();
  expect(assignmentBox).not.toBeNull();
  expect(removeBox).not.toBeNull();
  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(
    assignmentBox!.x + assignmentBox!.width,
  );
  await claraAssignment
    .getByRole("checkbox", { name: "Pode gerenciar" })
    .check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(page.getByText("Departamento atualizado.")).toBeVisible();
  await expect(louvor.getByText("Clara Souza")).toBeVisible();
  await expect(louvor.getByText(/Músico\(a\).*Líder gestor/)).toBeVisible();
  await page.getByRole("button", { name: "Pessoas", exact: true }).click();
  await page.getByText("Clara Souza", { exact: true }).click();
  const departmentsCard = page.locator(".info-card").filter({
    has: page.getByRole("heading", { name: "Departamentos" }),
  });
  await expect(departmentsCard.getByText("Ministério de Louvor")).toBeVisible();
  await expect(
    departmentsCard.getByText(/Cargo: Músico\(a\).*Líder gestor/),
  ).toBeVisible();
});

test("registra autorização infantil específica do culto", async ({ page }) => {
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await page.getByRole("button", { name: "Kids", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kids" })).toBeVisible();
  await page.getByRole("button", { name: "Crianças", exact: true }).click();
  await expect(page.getByText("Sofia Ribeiro", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Gerar autorização do culto de hoje",
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar termo assinado" }).click();
  await page.getByRole("checkbox", { name: "Fotografia", exact: true }).check();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByText("Confirmação do termo físico registrada para hoje."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Termo de hoje confirmado" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Grupos Kids" }).click();
  await page.getByRole("button", { name: "Novo grupo Kids" }).click();
  await page.getByLabel("Nome do grupo").fill("Pequenos Discípulos");
  await page
    .locator("label.check-card")
    .filter({ hasText: "Sofia Ribeiro" })
    .click();
  await page.getByRole("button", { name: "Salvar" }).click();
  await expect(
    page.getByText("Grupo Kids salvo com as crianças selecionadas."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pequenos Discípulos" }),
  ).toBeVisible();
  const pequenosDiscipulos = page.locator("article.child-card").filter({
    hasText: "Pequenos Discípulos",
  });
  await pequenosDiscipulos
    .getByRole("button", { name: "Ver crianças e autorizações" })
    .click();
  await expect(page.getByText("Aguardando o responsável")).toBeVisible();
  const printPopupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Imprimir termo" }).click();
  const printPopup = await printPopupPromise;
  await expect(
    printPopup.getByText("Assinatura de Mariana Ribeiro"),
  ).toBeVisible();
  await expect(
    printPopup.getByText("Assinatura de Carlos Ribeiro"),
  ).toBeVisible();
  await expect(printPopup.getByText(/CPF:/).first()).toBeVisible();
  await expect(printPopup.getByText(/Carlos Barbosa,/)).toBeVisible();
  await expect(
    printPopup.getByRole("button", { name: "Imprimir / salvar em PDF" }),
  ).toBeVisible();
  await printPopup.close();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar termo" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(
    "autorizacao-kids-sofia-ribeiro.html",
  );
  const downloadedTerm = await readFile((await download.path())!, "utf8");
  expect(downloadedTerm).toContain("Mariana Ribeiro");
  expect(downloadedTerm).toContain("Carlos Ribeiro");
  expect(downloadedTerm).toContain("Responsável legal 1");
  expect(downloadedTerm).toContain("Responsável legal 2");
  expect(downloadedTerm).toContain("Assinatura de Mariana Ribeiro");
  expect(downloadedTerm).toContain("Assinatura de Carlos Ribeiro");
  expect(downloadedTerm).toContain("<strong>CPF:</strong>");
  expect(downloadedTerm).toContain("Carlos Barbosa,");
  expect(downloadedTerm).toContain("Imprimir / salvar em PDF");
  await page.getByRole("button", { name: "Dar presença" }).click();
  await expect(page.getByText("Presença da criança registrada.")).toBeVisible();
  await expect(page.getByText(/Presente desde/)).toBeVisible();
  await page.getByRole("button", { name: "Voltar para os grupos" }).click();
  await page
    .getByRole("button", { name: "Autorizações por culto", exact: true })
    .click();
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
  await page.getByRole("button", { name: "Grupos Kids" }).click();
  await page
    .locator("article.child-card")
    .filter({ hasText: "Pequenos Discípulos" })
    .getByRole("button", { name: "Ver crianças e autorizações" })
    .click();
  await expect(page.getByText("Responsável autorizou")).toBeVisible();
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
  await page.getByRole("checkbox", { name: "Membro", exact: true }).check();
  await expect(page.getByLabel("Escolaridade")).not.toHaveAttribute(
    "required",
    "",
  );
  await page.getByLabel("Nome completo").fill("Rafael do Cadastro");
  await page.getByLabel("Data de nascimento").fill("12/03/1994");
  await page.getByLabel("Sexo").selectOption("Homem");
  await page.getByLabel("Escolaridade").selectOption("Ensino Superior");
  await page.getByLabel("Estado civil").selectOption("Solteiro(a)");
  await page.getByLabel("CPF").fill("987.654.321-00");
  await page.getByLabel("Possui filhos?").selectOption("Sim");
  await page.getByLabel("Nome completo do filho 1").fill("Gabriel Cadastro");
  await page.getByLabel("Data de nascimento do filho 1").fill("10/04/2016");
  await page.getByLabel("CPF do filho 1").fill("123.456.789-01");
  await page.getByLabel("Sexo do filho 1").selectOption("Homem");
  await page.getByRole("button", { name: "Adicionar outro filho" }).click();
  await page.getByLabel("Nome completo do filho 2").fill("Helena Cadastro");
  await page.getByLabel("Data de nascimento do filho 2").fill("22/09/2012");
  await page.getByLabel("CPF do filho 2").fill("123.456.789-02");
  await page.getByLabel("Sexo do filho 2").selectOption("Mulher");
  await page.getByLabel("Telefone WhatsApp").fill("11988887766");
  await page.getByLabel("E-mail").fill("rafael.cadastro@exemplo.org");
  await page.getByLabel("CEP").fill("01000-000");
  await page.getByLabel("CEP").press("Tab");
  await expect(page.getByLabel("Rua / endereço")).toHaveValue(
    "Rua preenchida pelo CEP",
  );
  await expect(page.getByLabel("Cidade")).toHaveValue("São Paulo");
  await expect(page.getByLabel("Complemento")).toHaveValue("");
  await page.getByLabel("Número").fill("25");
  await page.getByLabel("Complemento").fill("Casa 2");
  await page.getByLabel("É batizado(a)?").selectOption("no");
  await expect(
    page.getByRole("checkbox", {
      name: /Autorizo o tratamento dos meus dados pessoais/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar meu cadastro" }).click();
  await expect(
    page.getByRole("heading", { name: "Seja bem-vindo(a)!" }),
  ).toBeVisible();

  const savedFamily = await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("comunhao-workspace-v2") ?? "{}",
    );
    const parent = workspace.people?.find(
      (person: { full_name: string }) =>
        person.full_name === "Rafael do Cadastro",
    );
    const children = workspace.people?.filter((person: { full_name: string }) =>
      ["Gabriel Cadastro", "Helena Cadastro"].includes(person.full_name),
    );
    return {
      parent,
      children,
      profiles: workspace.children?.filter((profile: { person_id: string }) =>
        children.some(
          (child: { id: string }) => child.id === profile.person_id,
        ),
      ),
      guardians: workspace.guardians?.filter(
        (guardian: { guardian_person_id: string }) =>
          guardian.guardian_person_id === parent.id,
      ),
    };
  });
  const savedPerson = savedFamily.parent;
  expect(savedPerson.church_id).toBe("demo-church");
  expect(savedPerson.categories).toContain("Pré-cadastro");
  expect(savedPerson.categories).toContain("Membro");
  expect(savedPerson.children_names).toEqual([
    "Gabriel Cadastro",
    "Helena Cadastro",
  ]);
  expect(savedPerson.baptized).toBe(false);
  expect(savedPerson.consent.data_processing).toBe(false);
  expect(savedFamily.children).toHaveLength(2);
  expect(savedFamily.children[0].categories).toContain("Criança");
  expect(
    savedFamily.children.find(
      (child: { full_name: string }) => child.full_name === "Helena Cadastro",
    ).categories,
  ).toEqual(expect.arrayContaining(["Criança", "Adolescente"]));
  expect(savedFamily.children[0].address).toEqual(savedPerson.address);
  expect(
    savedFamily.children.map(
      (child: { birth_date: string }) => child.birth_date,
    ),
  ).toEqual(expect.arrayContaining(["2016-04-10", "2012-09-22"]));
  expect(savedFamily.profiles).toHaveLength(2);
  expect(savedFamily.guardians).toHaveLength(2);
  expect(
    savedFamily.guardians.every(
      (guardian: { legal_guardian: boolean }) => guardian.legal_guardian,
    ),
  ).toBe(true);
});

test("visitante faz cadastro simplificado pelo link", async ({ page }) => {
  await page.goto("/?cadastro=22222222-2222-4222-8222-222222222222");

  const firstSection = page
    .locator(".public-registration-card .form-section")
    .first();
  await expect(firstSection).toContainText("Como você está chegando?");
  await expect(firstSection.getByRole("checkbox")).toHaveCount(3);

  await page.getByRole("checkbox", { name: "Visitante", exact: true }).check();
  await expect(page.getByLabel("Nome completo")).toBeVisible();
  await expect(page.getByLabel("Telefone WhatsApp")).toBeVisible();
  await expect(page.getByLabel("CPF")).toHaveCount(0);
  await expect(page.getByLabel("Data de nascimento")).toHaveCount(0);
  await expect(page.getByLabel("E-mail")).toHaveCount(0);
  await expect(page.getByLabel("Possui filhos?")).toHaveCount(0);

  await page.getByLabel("Nome completo").fill("Visitante Cadastro");
  await page.getByLabel("Telefone WhatsApp").fill("11977776666");
  await expect(
    page.getByRole("checkbox", {
      name: /Autorizo o tratamento dos meus dados pessoais/,
    }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Enviar meu cadastro" }).click();
  await expect(
    page.getByRole("heading", { name: "Seja bem-vindo(a)!" }),
  ).toBeVisible();

  const visitor = await page.evaluate(() => {
    const workspace = JSON.parse(
      localStorage.getItem("comunhao-workspace-v2") ?? "{}",
    );
    return workspace.people?.find(
      (person: { full_name: string }) =>
        person.full_name === "Visitante Cadastro",
    );
  });
  expect(visitor.categories).toEqual(["Pré-cadastro", "Visitante"]);
  expect(visitor.phone_primary).toBe("(11) 97777-6666");
  expect(visitor.document_cpf).toBeUndefined();
  expect(visitor.email).toBeUndefined();
  expect(visitor.birth_date).toBeUndefined();
  expect(visitor.consent).toEqual(
    expect.objectContaining({ messaging: false, data_processing: false }),
  );
});
