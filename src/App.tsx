import { FormEvent, useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Baby,
  Building2,
  Camera,
  CalendarDays,
  Check,
  ClipboardCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Eye,
  EyeOff,
  FileSignature,
  Flame,
  GraduationCap,
  Globe,
  Hand,
  Heart,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Monitor,
  Music,
  Pencil,
  Phone,
  Plus,
  Printer,
  QrCode,
  Search,
  Share2,
  Settings,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Trash2,
  UserRound,
  Users,
  Video,
  Wallet,
  X,
} from "lucide-react";
import { isDemoMode, supabase } from "./lib/supabase";
import {
  Church,
  ChurchEvent,
  ChildAuthorization,
  DailyChildAuthorization,
  ChildProfile,
  Department,
  DepartmentAssignment,
  emptyConsent,
  emptyWorkspace,
  FinancialAccount,
  FinancialCategory,
  FinanceEntry,
  FamilyChildInput,
  GroupMembershipHistory,
  KidsGroup,
  checkInChild,
  generateKidsAuthorizations,
  getOrCreateChurchRegistrationLink,
  deleteDepartment,
  deletePerson,
  loadPublicChildAuthorization,
  loadPublicChurchRegistration,
  loadWorkspace,
  inviteTeamMember,
  loadTeam,
  newId,
  Person,
  PublicChildAuthorization,
  PublicChurchRegistration,
  resolveWorkspace,
  Role,
  saveChurch,
  saveChild,
  saveChildAuthorization,
  saveDailyChildAuthorization,
  saveDepartment,
  saveEvent,
  saveFinancialAccount,
  saveFinancialCategory,
  saveGroup,
  saveKidsGroup,
  savePersonFamily,
  saveTeachingMeeting,
  saveTransaction,
  respondPublicChildAuthorization,
  SelfRegistrationInput,
  submitPublicChurchRegistration,
  TeachingGroup,
  TeachingAttendance,
  TeachingMeeting,
  TeamMember,
  WorkspaceData,
} from "./lib/workspace";

type Page =
  | "Visão geral"
  | "Pessoas"
  | "Kids"
  | "Ensino"
  | "Departamentos"
  | "Agenda"
  | "Financeiro"
  | "Igrejas"
  | "Equipe e acessos";
type Identity = {
  id: string;
  name: string;
  email: string;
  role: Role;
  churchId: string | null;
  churchName: string;
};
type Modal =
  | { type: "person"; person?: Person }
  | { type: "group"; group?: TeachingGroup }
  | { type: "child" }
  | { type: "child-authorization"; authorization: ChildAuthorization }
  | { type: "daily-child-authorization"; childId: string }
  | { type: "kids-group"; group?: KidsGroup }
  | { type: "department"; department?: Department }
  | { type: "department-delete"; department: Department }
  | { type: "person-delete"; person: Person }
  | { type: "teaching-meeting"; group: TeachingGroup }
  | { type: "event"; date?: string; event?: ChurchEvent }
  | { type: "finance" }
  | { type: "finance-account" }
  | { type: "finance-category" }
  | { type: "church" }
  | null;

const nav: {
  section: string;
  items: { label: Page; icon: typeof Users; master?: boolean }[];
}[] = [
  {
    section: "GESTÃO",
    items: [
      { label: "Visão geral", icon: LayoutDashboard },
      { label: "Pessoas", icon: Users },
      { label: "Kids", icon: Baby },
      { label: "Ensino", icon: GraduationCap },
      { label: "Departamentos", icon: Building2 },
      { label: "Agenda", icon: CalendarDays },
      { label: "Financeiro", icon: Wallet },
    ],
  },
  {
    section: "ADMINISTRAÇÃO",
    items: [
      { label: "Igrejas", icon: Building2, master: true },
      { label: "Equipe e acessos", icon: ShieldCheck },
    ],
  },
];

function familyChildrenForPerson(data: WorkspaceData, person: Person) {
  const linkedChildren = data.guardians
    .filter((guardian) => guardian.guardian_person_id === person.id)
    .map((guardian) =>
      data.people.find((item) => item.id === guardian.child_id),
    )
    .filter((item): item is Person => Boolean(item));
  const namedChildren = (person.children_names ?? [])
    .map((name) =>
      data.people.find(
        (item) =>
          item.church_id === person.church_id &&
          item.id !== person.id &&
          item.full_name === name,
      ),
    )
    .filter((item): item is Person => Boolean(item));
  return [...linkedChildren, ...namedChildren]
    .filter(
      (child, index, all) =>
        all.findIndex((item) => item.id === child.id) === index,
    )
    .map((child) => ({
      id: child.id,
      full_name: child.full_name,
      birth_date: child.birth_date ?? "",
      gender: child.gender ?? "",
      document_cpf: child.document_cpf ?? "",
    }));
}

function AuthenticatedApp() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [booting, setBooting] = useState(!isDemoMode);
  const [page, setPage] = useState<Page>("Visão geral");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceData>(emptyWorkspace);
  const [selectedChurch, setSelectedChurch] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      setToast({
        message:
          type === "error"
            ? friendlyErrorMessage(message, "Não foi possível concluir a ação.")
            : message,
        type,
      });
      window.setTimeout(() => setToast(null), 3600);
    },
    [],
  );

  async function hydrateSession(session: Session) {
    const user = session.user;
    const context = await resolveWorkspace(
      user.id,
      user.app_metadata?.platform_role,
    );
    setIdentity({
      id: user.id,
      email: user.email ?? "",
      name:
        user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Usuário",
      ...context,
    });
    setSelectedChurch(context.churchId);
  }

  useEffect(() => {
    if (!supabase) return;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (data.session) await hydrateSession(data.session);
        setBooting(false);
      })
      .catch(() => setBooting(false));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setIdentity(null);
        setWorkspace(emptyWorkspace);
      } else {
        window.setTimeout(() => void hydrateSession(session), 0);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!identity) return;
    setLoading(true);
    loadWorkspace(selectedChurch, identity.role === "master")
      .then((data) => {
        setWorkspace(data);
        if (identity.role !== "master" && !selectedChurch && data.churches[0])
          setSelectedChurch(data.churches[0].id);
      })
      .catch((error) =>
        showToast(
          friendlyErrorMessage(
            error,
            "Não foi possível carregar os dados da igreja.",
          ),
          "error",
        ),
      )
      .finally(() => setLoading(false));
  }, [identity, selectedChurch, showToast]);

  async function handleLogin(email: string, password: string, demoRole: Role) {
    if (!supabase) {
      const context = await resolveWorkspace("demo-user", demoRole);
      setIdentity({ id: "demo-user", name: "Artur Silva", email, ...context });
      setSelectedChurch(context.churchId);
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.session) await hydrateSession(data.session);
  }
  async function logout() {
    if (supabase) await supabase.auth.signOut();
    setIdentity(null);
    setWorkspace(emptyWorkspace);
  }
  async function persist(
    action: () => Promise<WorkspaceData>,
    success: string,
  ) {
    try {
      setLoading(true);
      setWorkspace(await action());
      setModal(null);
      showToast(success);
    } catch (error) {
      showToast(
        friendlyErrorMessage(error, "Não foi possível salvar agora."),
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  if (booting) return <FullLoader />;
  if (!identity) return <Login onLogin={handleLogin} />;
  const displayPage =
    identity.role === "master"
      ? "Igrejas"
      : page === "Igrejas"
        ? "Visão geral"
        : page;
  const churchId =
    selectedChurch ?? identity.churchId ?? workspace.churches[0]?.id ?? "";
  const currentPerson = workspace.people.find(
    (person) => person.auth_user_id === identity.id,
  );
  const isDepartmentLeader = workspace.departmentMembers.some(
    (member) =>
      member.person_id === currentPerson?.id &&
      member.active &&
      member.can_manage,
  );
  const isTeachingLeader = workspace.groups.some(
    (group) => group.leader_id === currentPerson?.id && group.active,
  );

  return (
    <div className="app-shell">
      <Sidebar
        identity={identity}
        page={displayPage}
        open={mobileOpen}
        churches={workspace.churches}
        selectedChurch={churchId}
        isDepartmentLeader={isDepartmentLeader}
        isTeachingLeader={isTeachingLeader}
        onChurch={setSelectedChurch}
        onClose={() => setMobileOpen(false)}
        onNavigate={(p) => {
          setPage(p);
          setSelectedPerson(null);
          setMobileOpen(false);
        }}
        onLogout={logout}
      />
      <main className="main">
        <Header
          page={displayPage}
          identity={identity}
          onMenu={() => setMobileOpen(true)}
        />
        <div className="page-wrap">
          {!churchId && identity.role === "master" && (
            <EmptyState
              icon={Building2}
              title="Crie a primeira igreja"
              text="O ambiente Master ainda não possui uma igreja."
              action="Nova igreja"
              onAction={() => setModal({ type: "church" })}
            />
          )}
          {!churchId && identity.role !== "master" && (
            <EmptyState
              icon={ShieldCheck}
              title="Nenhuma igreja vinculada"
              text="Peça ao Administrador da Plataforma ou ao Gestor Geral para enviar seu convite de acesso."
              action="Atualizar sessão"
              onAction={() => window.location.reload()}
            />
          )}
          {churchId &&
            identity.role !== "master" &&
            displayPage === "Visão geral" && (
              <Dashboard data={workspace} onNavigate={setPage} />
            )}
          {churchId &&
            displayPage === "Pessoas" &&
            (selectedPerson ? (
              <PersonDetail
                person={selectedPerson}
                data={workspace}
                groups={workspace.groups}
                groupHistory={workspace.groupHistory.filter(
                  (entry) => entry.person_id === selectedPerson.id,
                )}
                onBack={() => setSelectedPerson(null)}
                onEdit={() =>
                  setModal({ type: "person", person: selectedPerson })
                }
                canDelete={identity.role === "super"}
                onDelete={() =>
                  setModal({ type: "person-delete", person: selectedPerson })
                }
              />
            ) : (
              <People
                people={workspace.people}
                onAdd={() => setModal({ type: "person" })}
                onOpen={setSelectedPerson}
                onRegistrationLink={async () => {
                  const token =
                    await getOrCreateChurchRegistrationLink(churchId);
                  const url = new URL(window.location.href);
                  url.search = "";
                  url.hash = "";
                  url.searchParams.set("cadastro", token);
                  return url.toString();
                }}
                notify={showToast}
              />
            ))}
          {churchId && displayPage === "Kids" && (
            <Kids
              data={workspace}
              onAddChild={() => setModal({ type: "child" })}
              onAuthorization={(authorization) =>
                setModal({ type: "child-authorization", authorization })
              }
              onDailyAuthorization={(childId) =>
                setModal({ type: "daily-child-authorization", childId })
              }
              onKidsGroup={(group) => setModal({ type: "kids-group", group })}
              onGenerate={(eventId) =>
                persist(
                  () => generateKidsAuthorizations(workspace, eventId),
                  "Autorizações pendentes geradas para este culto.",
                )
              }
              onCheckIn={(
                eventId,
                childId,
                guardianId,
                authorizationId,
                pickupCode,
              ) =>
                persist(
                  () =>
                    checkInChild(workspace, {
                      id: newId(),
                      church_id: churchId,
                      event_id: eventId,
                      child_id: childId,
                      guardian_id: guardianId,
                      authorization_id: authorizationId,
                      checkin_at: new Date().toISOString(),
                      pickup_code: pickupCode,
                    }),
                  "Presença da criança registrada.",
                )
              }
              notify={showToast}
            />
          )}
          {churchId && displayPage === "Ensino" && (
            <Teaching
              data={workspace}
              currentUserId={identity.id}
              canCreate={
                identity.role === "super" || identity.role === "teaching"
              }
              onAdd={() => setModal({ type: "group" })}
              onEdit={(group) => setModal({ type: "group", group })}
              onMeeting={(group) =>
                setModal({ type: "teaching-meeting", group })
              }
            />
          )}
          {churchId && displayPage === "Departamentos" && (
            <Departments
              data={workspace}
              currentUserId={identity.id}
              isGeneralManager={identity.role === "super"}
              onAdd={() => setModal({ type: "department" })}
              onEdit={(department) =>
                setModal({ type: "department", department })
              }
              onDelete={(department) =>
                setModal({ type: "department-delete", department })
              }
            />
          )}
          {churchId && displayPage === "Agenda" && (
            <Agenda
              events={workspace.events}
              onAdd={(date) => setModal({ type: "event", date })}
              onEdit={(event) => setModal({ type: "event", event })}
            />
          )}
          {churchId && displayPage === "Financeiro" && (
            <Finance
              entries={workspace.transactions}
              accounts={workspace.accounts}
              categories={workspace.categories}
              onAdd={() => setModal({ type: "finance" })}
              onAddAccount={() => setModal({ type: "finance-account" })}
              onAddCategory={() => setModal({ type: "finance-category" })}
            />
          )}
          {identity.role === "master" && displayPage === "Igrejas" && (
            <Churches
              churches={workspace.churches}
              onAdd={() => setModal({ type: "church" })}
            />
          )}
          {churchId && displayPage === "Equipe e acessos" && (
            <Access
              role={identity.role}
              churchId={churchId}
              churchName={
                workspace.churches.find((c) => c.id === churchId)?.name ??
                identity.churchName
              }
              notify={showToast}
            />
          )}
        </div>
      </main>
      {modal?.type === "person" && (
        <PersonForm
          churchId={churchId}
          initial={modal.person}
          familyChildren={
            modal.person ? familyChildrenForPerson(workspace, modal.person) : []
          }
          availablePeople={workspace.people}
          onClose={() => setModal(null)}
          notify={showToast}
          onSave={(person, familyChildren) =>
            persist(
              () => savePersonFamily(workspace, person, familyChildren),
              modal.person ? "Cadastro atualizado." : "Pessoa cadastrada.",
            )
          }
        />
      )}
      {modal?.type === "group" && (
        <GroupForm
          churchId={churchId}
          people={workspace.people}
          initial={modal.group}
          onClose={() => setModal(null)}
          onSave={(group) =>
            persist(
              () => saveGroup(workspace, group),
              modal.group ? "Grupo atualizado." : "Grupo criado.",
            )
          }
        />
      )}
      {modal?.type === "child" && (
        <ChildForm
          churchId={churchId}
          people={workspace.people}
          profiles={workspace.children}
          onClose={() => setModal(null)}
          onSave={(person, profile, guardianId, relationship) =>
            persist(
              () =>
                saveChild(workspace, person, profile, guardianId, relationship),
              "Criança cadastrada com responsável.",
            )
          }
        />
      )}
      {modal?.type === "child-authorization" && (
        <ChildAuthorizationForm
          authorization={modal.authorization}
          data={workspace}
          onClose={() => setModal(null)}
          onSave={(authorization) =>
            persist(
              () => saveChildAuthorization(workspace, authorization),
              "Decisão do responsável registrada.",
            )
          }
        />
      )}
      {modal?.type === "daily-child-authorization" && (
        <DailyChildAuthorizationForm
          childId={modal.childId}
          data={workspace}
          onClose={() => setModal(null)}
          onSave={(authorization) =>
            persist(
              () => saveDailyChildAuthorization(workspace, authorization),
              "Confirmação do termo físico registrada para hoje.",
            )
          }
        />
      )}
      {modal?.type === "kids-group" && (
        <KidsGroupForm
          churchId={churchId}
          data={workspace}
          initial={modal.group}
          onClose={() => setModal(null)}
          onSave={(group) =>
            persist(
              () => saveKidsGroup(workspace, group),
              "Grupo Kids salvo com as crianças selecionadas.",
            )
          }
        />
      )}
      {modal?.type === "department" && (
        <DepartmentForm
          churchId={churchId}
          data={workspace}
          initial={modal.department}
          onClose={() => setModal(null)}
          onSave={(department, roles, assignments) =>
            persist(
              () => saveDepartment(workspace, department, roles, assignments),
              modal.department
                ? "Departamento atualizado."
                : "Departamento criado.",
            )
          }
        />
      )}
      {modal?.type === "department-delete" && (
        <DeleteDepartmentDialog
          department={modal.department}
          onClose={() => setModal(null)}
          onConfirm={() =>
            persist(
              () => deleteDepartment(workspace, modal.department),
              "Departamento excluído.",
            )
          }
        />
      )}
      {modal?.type === "person-delete" && (
        <DeletePersonDialog
          person={modal.person}
          onClose={() => setModal(null)}
          onConfirm={() => {
            const person = modal.person;
            void persist(
              () => deletePerson(workspace, person),
              "Pessoa excluída com seus vínculos.",
            );
            setSelectedPerson(null);
          }}
        />
      )}
      {modal?.type === "teaching-meeting" && (
        <TeachingMeetingForm
          churchId={churchId}
          group={modal.group}
          people={workspace.people}
          onClose={() => setModal(null)}
          onSave={(meeting, attendance) =>
            persist(
              () => saveTeachingMeeting(workspace, meeting, attendance),
              "Aula e frequência registradas.",
            )
          }
        />
      )}
      {modal?.type === "event" && (
        <EventForm
          churchId={churchId}
          initialDate={modal.date}
          initial={modal.event}
          onClose={() => setModal(null)}
          onSave={(event) =>
            persist(
              () => saveEvent(workspace, event),
              modal.event
                ? "Compromisso atualizado."
                : "Compromisso adicionado.",
            )
          }
        />
      )}
      {modal?.type === "finance" && (
        <FinanceForm
          churchId={churchId}
          accounts={workspace.accounts}
          categories={workspace.categories}
          onClose={() => setModal(null)}
          onSave={(entry) =>
            persist(
              () => saveTransaction(workspace, entry),
              "Lançamento salvo.",
            )
          }
        />
      )}
      {modal?.type === "finance-account" && (
        <FinancialAccountForm
          churchId={churchId}
          onClose={() => setModal(null)}
          onSave={(account) =>
            persist(
              () => saveFinancialAccount(workspace, account),
              "Conta financeira criada.",
            )
          }
        />
      )}
      {modal?.type === "finance-category" && (
        <FinancialCategoryForm
          churchId={churchId}
          onClose={() => setModal(null)}
          onSave={(category) =>
            persist(
              () => saveFinancialCategory(workspace, category),
              "Categoria criada.",
            )
          }
        />
      )}
      {modal?.type === "church" && (
        <ChurchForm
          onClose={() => setModal(null)}
          onSave={(church, manager) =>
            persist(
              () => saveChurch(workspace, church, manager),
              "Igreja e acesso do Gestor Geral criados.",
            )
          }
        />
      )}
      {loading && (
        <div className="saving-indicator">
          <LoaderCircle className="spin" /> Sincronizando
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.type}`} role="status">
          {toast.type === "success" ? <Check /> : <X />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function FullLoader() {
  return (
    <div className="full-loader">
      <Brand />
      <LoaderCircle className="spin" />
    </div>
  );
}
function BrandMark() {
  return (
    <span className="brand-mark">
      <span />
      <span />
      <span />
    </span>
  );
}
function Brand() {
  return (
    <div className="brand">
      <BrandMark />
      <span>comunhão</span>
    </div>
  );
}

function Login({
  onLogin,
}: {
  onLogin: (email: string, password: string, role: Role) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>("super"),
    [email, setEmail] = useState(isDemoMode ? "gestor@igreja.org" : ""),
    [password, setPassword] = useState(isDemoMode ? "comunhao123" : "");
  const [showPassword, setShowPassword] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onLogin(email, password, role);
    } catch (err) {
      setError(friendlyErrorMessage(err, "Não foi possível entrar."));
    } finally {
      setBusy(false);
    }
  }
  async function resetPassword() {
    if (!email) return setError("Digite seu e-mail primeiro.");
    if (!supabase)
      return setError(
        "No modo demonstração não é necessário redefinir a senha.",
      );
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: window.location.origin },
    );
    setError(
      resetError
        ? translateAuthError(resetError.message)
        : "Enviamos as instruções para o seu e-mail.",
    );
  }
  return (
    <div className="login-page">
      <section className="login-story">
        <div className="brand light">
          <BrandMark />
          <span>comunhão</span>
        </div>
        <div className="story-copy">
          <span className="eyebrow light-text">
            <Sparkles size={15} /> FEITO PARA SERVIR QUEM CUIDA
          </span>
          <h1>
            Gestão simples.
            <br />
            <em>Comunidade mais próxima.</em>
          </h1>
          <p>Pessoas, ensino, agenda e finanças em um só lugar.</p>
        </div>
        <div className="story-metrics">
          <div>
            <strong>1 só lugar</strong>
            <span>para toda a gestão</span>
          </div>
          <div>
            <strong>Dados protegidos</strong>
            <span>por igreja e por cargo</span>
          </div>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <span className="eyebrow">BEM-VINDO DE VOLTA</span>
          <h2>Acesse sua comunidade</h2>
          <p>Entre com o usuário cadastrado no Supabase.</p>
          {isDemoMode && (
            <>
              <div className="demo-note">
                <Sparkles size={17} />
                <span>
                  <strong>Modo demonstração</strong> — a configuração local do
                  Supabase ainda não foi encontrada.
                </span>
              </div>
              <div className="role-switch">
                <button
                  type="button"
                  className={role === "super" ? "active" : ""}
                  onClick={() => {
                    setRole("super");
                    setEmail("gestor@igreja.org");
                  }}
                >
                  <UserRound size={18} /> Gestor
                </button>
                <button
                  type="button"
                  className={role === "master" ? "active" : ""}
                  onClick={() => {
                    setRole("master");
                    setEmail("master@comunhao.app");
                  }}
                >
                  <ShieldCheck size={18} /> Superusuário
                </button>
              </div>
            </>
          )}
          <label>
            E-mail
            <div className="input-with-icon">
              <Mail />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </label>
          <div className="login-field">
            <label htmlFor="login-password">Senha</label>
            <div className="password input-with-icon">
              <LockKeyhole />
              <input
                id="login-password"
                aria-label="Senha"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </div>
          <button type="button" className="forgot" onClick={resetPassword}>
            Esqueci minha senha
          </button>
          {error && (
            <div className="form-message" role="alert">
              {error}
            </div>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" />
            ) : (
              <>
                Entrar no sistema <ChevronRight />
              </>
            )}
          </button>
        </form>
      </section>
    </div>
  );
}
function translateAuthError(message: string) {
  if (message.includes("Invalid login")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  return friendlyErrorMessage(message, "Não foi possível entrar.");
}

function friendlyErrorMessage(reason: unknown, fallback: string) {
  const errorRecord =
    reason && typeof reason === "object"
      ? (reason as Record<string, unknown>)
      : null;
  const raw =
    reason instanceof Error
      ? reason.message
      : typeof reason === "string"
        ? reason
        : typeof errorRecord?.message === "string"
          ? errorRecord.message
          : typeof errorRecord?.details === "string"
            ? errorRecord.details
            : "";
  const message = raw.trim();
  if (!message) return fallback;
  const lower = message.toLowerCase();
  if (lower.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (lower.includes("email not confirmed"))
    return "Confirme seu e-mail antes de entrar.";
  if (lower.includes("jwt") || lower.includes("session"))
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("fetch")
  )
    return "Falha de conexão. Confira a internet e tente novamente.";
  if (
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    lower.includes("403") ||
    lower.includes("42501")
  )
    return "Você não tem permissão para fazer essa alteração.";
  if (
    lower.includes("duplicate key") ||
    lower.includes("already exists") ||
    lower.includes("23505")
  )
    return "Já existe um cadastro com essas informações.";
  if (lower.includes("invalid input syntax for type date"))
    return "Revise as datas informadas. Use o formato dia/mês/ano.";
  if (
    lower.includes("invalid refresh token") ||
    lower.includes("refresh token not found")
  )
    return "Sua sessão expirou. Entre novamente para continuar.";
  if (lower.includes("function") && lower.includes("not"))
    return "Uma função do Supabase ainda não está publicada. Publique as funções e tente novamente.";
  const technicalTerms = [
    "supabase",
    "postgrest",
    "pgrst",
    "violates",
    "foreign key",
    "invalid input syntax",
    "relation",
    "column",
    "edge function",
    "status code",
  ];
  if (technicalTerms.some((term) => lower.includes(term))) return fallback;
  return message;
}

function Sidebar({
  identity,
  page,
  open,
  churches,
  selectedChurch,
  isDepartmentLeader,
  isTeachingLeader,
  onChurch,
  onClose,
  onNavigate,
  onLogout,
}: {
  identity: Identity;
  page: Page;
  open: boolean;
  churches: Church[];
  selectedChurch: string;
  isDepartmentLeader: boolean;
  isTeachingLeader: boolean;
  onChurch: (id: string) => void;
  onClose: () => void;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
}) {
  const church = churches.find((c) => c.id === selectedChurch);
  return (
    <>
      {open && <button className="scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-top">
          <Brand />
          <button className="icon-only mobile-close" onClick={onClose}>
            <X />
          </button>
        </div>
        <label className="church-picker">
          <span className="church-avatar">
            {initials(church?.name ?? identity.churchName)}
          </span>
          <span>
            <small>
              {identity.role === "master" ? "PLATAFORMA" : "IGREJA ATUAL"}
            </small>
            <strong>
              {identity.role === "master"
                ? "Administração de igrejas"
                : (church?.name ?? identity.churchName)}
            </strong>
          </span>
          {identity.role !== "master" && churches.length > 1 ? (
            <select
              value={selectedChurch}
              onChange={(e) => onChurch(e.target.value)}
            >
              {churches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          ) : (
            <ChevronDown />
          )}
        </label>
        <nav>
          {nav.map((section) => (
            <div className="nav-section" key={section.section}>
              <span className="nav-title">{section.section}</span>
              {section.items
                .filter((item) =>
                  identity.role === "master"
                    ? item.label === "Igrejas"
                    : !item.master &&
                      (identity.role === "super" ||
                        item.label === "Visão geral" ||
                        (item.label === "Departamentos" &&
                          isDepartmentLeader) ||
                        (item.label === "Ensino" && isTeachingLeader) ||
                        (identity.role === "people" &&
                          ["Pessoas", "Kids", "Departamentos"].includes(
                            item.label,
                          )) ||
                        (identity.role === "teaching" &&
                          item.label === "Ensino") ||
                        (identity.role === "finance" &&
                          item.label === "Financeiro") ||
                        (identity.role === "agenda" &&
                          item.label === "Agenda")),
                )
                .map((item) => (
                  <button
                    key={item.label}
                    className={page === item.label ? "active" : ""}
                    onClick={() => onNavigate(item.label)}
                  >
                    <item.icon />
                    {item.label}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-card">
            <span className="avatar">{initials(identity.name)}</span>
            <span>
              <strong>{identity.name}</strong>
              <small>{roleLabel(identity.role)}</small>
            </span>
          </div>
          <button className="logout" onClick={onLogout}>
            <LogOut /> Sair do sistema
          </button>
        </div>
      </aside>
    </>
  );
}
function Header({
  page,
  identity,
  onMenu,
}: {
  page: Page;
  identity: Identity;
  onMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div>
        <button className="icon-only menu-button" onClick={onMenu}>
          <Menu />
        </button>
        <span className="breadcrumb">
          Comunhão <ChevronRight /> <b>{page}</b>
        </span>
      </div>
      <div className="top-actions">
        <span className="role-pill">
          <ShieldCheck /> {roleLabel(identity.role)}
        </span>
        <button className="icon-only">
          <Settings />
        </button>
        <span className="avatar small">{initials(identity.name)}</span>
      </div>
    </header>
  );
}
function roleLabel(role: Role) {
  return {
    master: "Superusuário da plataforma",
    super: "Gestor geral",
    people: "Pessoas",
    teaching: "Ensino",
    finance: "Financeiro",
    agenda: "Agenda",
    viewer: "Consulta",
  }[role];
}
function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
function PageHead({
  eyebrow,
  title,
  text,
  action,
  onAction,
}: {
  eyebrow: string;
  title: string;
  text: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {action && (
        <button className="primary" onClick={onAction}>
          <Plus />
          {action}
        </button>
      )}
    </div>
  );
}
function CardTitle({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="card-title">
      <h2>{title}</h2>
      {action && (
        <button onClick={onAction}>
          {action}
          <ChevronRight />
        </button>
      )}
    </div>
  );
}
function EmptyState({
  icon: Icon,
  title,
  text,
  action,
  onAction,
}: {
  icon: typeof Users;
  title: string;
  text: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <section className="empty-state card">
      <span className="cep-input-row">
        <Icon />
      </span>
      <h2>{title}</h2>
      <p>{text}</p>
      <button className="primary" onClick={onAction}>
        <Plus />
        {action}
      </button>
    </section>
  );
}

function Dashboard({
  data,
  onNavigate,
}: {
  data: WorkspaceData;
  onNavigate: (p: Page) => void;
}) {
  const income = data.transactions
      .filter((t) => t.type === "income" && t.status === "paid")
      .reduce((s, t) => s + t.amount, 0),
    expense = data.transactions
      .filter((t) => t.type === "expense" && t.status === "paid")
      .reduce((s, t) => s + t.amount, 0);
  return (
    <>
      <PageHead
        eyebrow="VISÃO DA COMUNIDADE"
        title="Olá. Vamos cuidar da comunidade?"
        text="Informações reais da igreja selecionada, organizadas para a sua equipe."
      />
      <section className="hero-card">
        <div>
          <span className="eyebrow light-text">
            <Sparkles /> ACOMPANHAMENTO
          </span>
          <h2>
            Uma igreja que acompanha
            <br />é uma igreja que acolhe.
          </h2>
          <p>{data.people.length} pessoas estão registradas.</p>
          <button
            className="light-button"
            onClick={() => onNavigate("Pessoas")}
          >
            Abrir pessoas <ChevronRight />
          </button>
        </div>
        <div className="hero-orbit">
          <span className="orbit one">
            <Users />
          </span>
          <span className="orbit two">
            <BookOpen />
          </span>
          <span className="orbit three">
            <Check />
          </span>
          <div>
            <strong>{data.groups.length}</strong>
            <span>grupos ativos</span>
          </div>
        </div>
      </section>
      <div className="metric-grid">
        <Metric
          icon={Users}
          label="Pessoas ativas"
          value={String(data.people.filter((p) => p.active).length)}
          detail="cadastros na igreja"
        />
        <Metric
          icon={GraduationCap}
          label="Grupos de ensino"
          value={String(data.groups.filter((g) => g.active).length)}
          detail={`${data.groups.reduce((s, g) => s + (g.members ?? 0), 0)} participantes`}
        />
        <Metric
          icon={CalendarDays}
          label="Compromissos"
          value={String(data.events.length)}
          detail="na agenda"
        />
        <Metric
          icon={TrendingUp}
          label="Saldo financeiro"
          value={currency(income - expense)}
          detail="lançamentos pagos"
          positive={income >= expense}
        />
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <CardTitle
            title="Próximos compromissos"
            action="Abrir agenda"
            onAction={() => onNavigate("Agenda")}
          />
          {data.events.slice(0, 4).map((e) => (
            <div className="event-row" key={e.id}>
              <span className={`date-block ${e.color}`}>
                <b>{new Date(e.starts_at).getDate()}</b>
                <small>
                  {new Date(e.starts_at).toLocaleDateString("pt-BR", {
                    month: "short",
                  })}
                </small>
              </span>
              <span>
                <strong>{e.title}</strong>
                <small>
                  {dateTime(e.starts_at)} • {e.location || "Local a definir"}
                </small>
              </span>
            </div>
          ))}
          {!data.events.length && (
            <p className="inline-empty">Nenhum compromisso cadastrado.</p>
          )}
        </section>
        <section className="card">
          <CardTitle
            title="Grupos em andamento"
            action="Ver ensino"
            onAction={() => onNavigate("Ensino")}
          />
          {data.groups.slice(0, 4).map((g) => (
            <div className="simple-row" key={g.id}>
              <span className="metric-icon">
                <BookOpen />
              </span>
              <span>
                <strong>{g.name}</strong>
                <small>
                  {g.track} • {g.members ?? 0} participantes
                </small>
              </span>
            </div>
          ))}
          {!data.groups.length && (
            <p className="inline-empty">Nenhum grupo cadastrado.</p>
          )}
        </section>
      </div>
    </>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
  detail,
  positive,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
}) {
  return (
    <article className="metric-card">
      <span className="metric-icon">
        <Icon />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={positive ? "positive" : ""}>{detail}</small>
      </div>
    </article>
  );
}

function People({
  people,
  onAdd,
  onOpen,
  onRegistrationLink,
  notify,
}: {
  people: Person[];
  onAdd: () => void;
  onOpen: (p: Person) => void;
  onRegistrationLink: () => Promise<string>;
  notify: (message: string, type?: "success" | "error") => void;
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [registrationLink, setRegistrationLink] = useState(""),
    [creatingLink, setCreatingLink] = useState(false);
  async function createRegistrationLink() {
    setCreatingLink(true);
    try {
      const link = await onRegistrationLink();
      setRegistrationLink(link);
      try {
        await navigator.clipboard.writeText(link);
        notify("Link de cadastro copiado. Ele é válido por 90 dias.");
      } catch {
        notify("Link gerado. Selecione o endereço exibido para copiar.");
      }
    } catch (error) {
      notify(
        friendlyErrorMessage(
          error,
          "Não foi possível gerar o link de cadastro.",
        ),
        "error",
      );
    } finally {
      setCreatingLink(false);
    }
  }
  const shown = people.filter(
    (p) =>
      `${p.full_name} ${p.phone_primary ?? ""} ${p.email ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" || (status === "active" ? p.active : !p.active)),
  );
  return (
    <>
      <PageHead
        eyebrow="COMUNIDADE"
        title="Pessoas"
        text="Ficha completa, vínculos, cuidado pastoral e consentimentos LGPD."
        action="Nova pessoa"
        onAction={onAdd}
      />
      <section className="card registration-link-card">
        <div>
          <span className="registration-link-icon">
            <Share2 />
          </span>
          <span>
            <strong>Cadastro online da igreja</strong>
            <small>
              Compartilhe este link. A ficha chegará como Pré-cadastro já
              vinculada à igreja.
            </small>
          </span>
        </div>
        {registrationLink && (
          <input
            aria-label="Link público de cadastro"
            readOnly
            value={registrationLink}
            onFocus={(event) => event.currentTarget.select()}
          />
        )}
        <button
          className="secondary"
          onClick={createRegistrationLink}
          disabled={creatingLink}
        >
          {creatingLink ? <LoaderCircle className="spin" /> : <Share2 />}
          {registrationLink ? "Copiar novamente" : "Gerar e copiar link"}
        </button>
      </section>
      <div className="toolbar">
        <div className="search">
          <Search />
          <input
            placeholder="Buscar por nome, telefone ou e-mail..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="secondary"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Todos os status</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
        </select>
      </div>
      <section className="card table-card">
        <div className="table-meta">
          <strong>{shown.length} pessoas</strong>
          <span>Selecione para abrir a ficha</span>
        </div>
        <div className="data-table people-table">
          <div className="table-header">
            <span>Pessoa</span>
            <span>Contato</span>
            <span>Categorias</span>
            <span>Status</span>
            <span />
          </div>
          {shown.map((p) => (
            <button
              className="table-row clickable-row"
              key={p.id}
              onClick={() => onOpen(p)}
            >
              <span className="person-cell">
                <span className="avatar green">{initials(p.full_name)}</span>
                <span>
                  <strong>{p.full_name}</strong>
                  <small>{p.email || "Sem e-mail"}</small>
                </span>
              </span>
              <span>
                {p.phone_primary ? maskPhone(p.phone_primary) : "Não informado"}
              </span>
              <span>{p.categories.join(", ") || "Sem categoria"}</span>
              <span>
                <b className={`status ${!p.active ? "inactive" : ""}`}>
                  {p.active ? "Ativo" : "Inativo"}
                </b>
              </span>
              <ChevronRight />
            </button>
          ))}
        </div>
        {!shown.length && (
          <p className="inline-empty">Nenhuma pessoa encontrada.</p>
        )}
      </section>
    </>
  );
}

function PersonDetail({
  person,
  data,
  groups,
  groupHistory,
  onBack,
  onEdit,
  canDelete,
  onDelete,
}: {
  person: Person;
  data: WorkspaceData;
  groups: TeachingGroup[];
  groupHistory: GroupMembershipHistory[];
  onBack: () => void;
  onEdit: () => void;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [tab, setTab] = useState<"info" | "church" | "consent">("info"),
    age = person.birth_date
      ? Math.floor(
          (Date.now() - new Date(person.birth_date).getTime()) / 31557600000,
        )
      : null,
    personGroups = groups.filter((group) =>
      person.group_ids.includes(group.id),
    ),
    personDepartments = data.departmentMembers
      .filter((member) => member.person_id === person.id && member.active)
      .map((member) => ({
        ...member,
        department: data.departments.find(
          (department) => department.id === member.department_id,
        ),
        role: data.departmentRoles.find((role) => role.id === member.role_id),
      }))
      .filter((membership) => membership.department),
    isChild =
      (age !== null && age < 18) ||
      person.categories.some((category) =>
        ["Criança", "Adolescente"].includes(category),
      ),
    childGuardians = data.guardians
      .filter((guardian) => guardian.child_id === person.id)
      .map((guardian) => ({
        ...guardian,
        person: data.people.find(
          (candidate) => candidate.id === guardian.guardian_person_id,
        ),
      }))
      .filter((guardian) => guardian.person),
    guardiansSummary = childGuardians
      .map((guardian) => {
        const phone = guardian.person?.phone_primary
          ? maskPhone(guardian.person.phone_primary)
          : undefined;
        return [guardian.person?.full_name, guardian.relationship, phone]
          .filter(Boolean)
          .join(" • ");
      })
      .join(" | ");
  return (
    <>
      <div className="detail-head">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft />
          Voltar
        </button>
        <div className="detail-head-actions">
          {canDelete && (
            <button className="danger" onClick={onDelete}>
              <Trash2 /> Excluir pessoa
            </button>
          )}
          <button className="primary" onClick={onEdit}>
            <Pencil />
            Editar cadastro
          </button>
        </div>
      </div>
      <section className="profile-hero card">
        <span className="profile-avatar">{initials(person.full_name)}</span>
        <div>
          <span className="eyebrow">FICHA DA PESSOA</span>
          <h1>{person.full_name}</h1>
          <p>
            {person.categories.join(" • ") || "Sem categoria"}{" "}
            {age !== null && `• ${age} anos`}
          </p>
          <div className="profile-contact">
            {person.phone_primary && (
              <span>
                <Phone />
                {maskPhone(person.phone_primary)}
              </span>
            )}
            {person.email && (
              <span>
                <Mail />
                {person.email}
              </span>
            )}
          </div>
        </div>
        <b className={`status ${!person.active ? "inactive" : ""}`}>
          {person.active ? "Cadastro ativo" : "Cadastro inativo"}
        </b>
      </section>
      <div className="detail-tabs">
        <button
          className={tab === "info" ? "active" : ""}
          onClick={() => setTab("info")}
        >
          Informações e vida na igreja
        </button>
        <button
          className={tab === "consent" ? "active" : ""}
          onClick={() => setTab("consent")}
        >
          Consentimentos LGPD
        </button>
      </div>
      {tab === "info" && (
        <div className="detail-grid">
          <InfoCard
            title={isChild ? "Dados da criança" : "Dados pessoais"}
            icon={UserRound}
            rows={
              isChild
                ? [
                    ["CPF", maskCpf(person.document_cpf ?? "")],
                    [
                      "Nascimento",
                      person.birth_date
                        ? formatDate(person.birth_date)
                        : undefined,
                    ],
                    ["Sexo", person.gender],
                    ["Responsáveis", guardiansSummary || undefined],
                  ]
                : [
                    [
                      "Nascimento",
                      person.birth_date
                        ? formatDate(person.birth_date)
                        : undefined,
                    ],
                    ["Sexo", person.gender],
                    ["Escolaridade", person.education],
                    ["Estado civil", person.marital_status],
                    ["Cônjuge", person.spouse_name],
                    ["Filhos", person.children_names?.join(", ")],
                    ["CPF", maskCpf(person.document_cpf ?? "")],
                  ]
            }
          />
          <InfoCard
            title="Contato e endereço"
            icon={Phone}
            rows={[
              [
                "Telefone WhatsApp",
                person.phone_primary
                  ? maskPhone(person.phone_primary)
                  : undefined,
              ],
              [
                "Telefone alternativo",
                person.phone_secondary
                  ? maskPhone(person.phone_secondary)
                  : undefined,
              ],
              ["E-mail", person.email],
              [
                "Endereço",
                [person.address.street, person.address.number]
                  .filter(Boolean)
                  .join(", "),
              ],
              ["Bairro", person.address.district],
              ["Complemento", person.address.complement],
              ["CEP", person.address.zip],
              [
                "Cidade/UF",
                [person.address.city, person.address.state]
                  .filter(Boolean)
                  .join(" / "),
              ],
              ["País", person.address.country],
            ]}
          />
          <InfoCard
            title="Informações complementares"
            icon={Pencil}
            rows={[["Informações que acha importante", person.notes]]}
          />
        </div>
      )}
      {tab === "info" && (
        <div className="detail-grid">
          <InfoCard
            title="Jornada espiritual"
            icon={BookOpen}
            rows={[
              [
                "Data de conversão",
                person.conversion_date
                  ? formatDate(person.conversion_date)
                  : undefined,
              ],
              [
                "Data do batismo",
                person.baptism_date
                  ? formatDate(person.baptism_date)
                  : undefined,
              ],
              ["Categorias", person.categories.join(", ")],
            ]}
          />
          <section className="card info-card">
            <h2>
              <Building2 />
              Departamentos
            </h2>
            {personDepartments.map((membership) => (
              <div
                className="simple-row"
                key={membership.department_id}
              >
                <span className="metric-icon">
                  <Building2 />
                </span>
                <span>
                  <strong>{membership.department?.name}</strong>
                  <small>
                    Cargo: {membership.role?.title ?? "Não informado"}
                    {membership.can_manage ? " • Líder gestor" : ""}
                    {membership.joined_at
                      ? ` • Desde ${formatDate(membership.joined_at)}`
                      : ""}
                  </small>
                </span>
              </div>
            ))}
            {!personDepartments.length && (
              <p className="inline-empty">
                Nenhum departamento vinculado.
              </p>
            )}
          </section>
          <section className="card info-card">
            <h2>
              <GraduationCap />
              Grupos de ensino
            </h2>
            {personGroups.map((g) => (
              <div className="simple-row" key={g.id}>
                <span className="metric-icon">
                  <BookOpen />
                </span>
                <span>
                  <strong>{g.name}</strong>
                  <small>
                    {g.track} • Cargo: {person.group_roles?.[g.id] ?? "Aluno(a)"}
                  </small>
                </span>
              </div>
            ))}
            {!personGroups.length && (
              <p className="inline-empty">Nenhum grupo vinculado.</p>
            )}
          </section>
          <section className="card info-card">
            <h2>
              <ClipboardCheck />
              Histórico de grupos de ensino
            </h2>
            {groupHistory.map((entry) => (
              <div className="simple-row" key={entry.id}>
                <span className="metric-icon">
                  {entry.action === "joined" ? <Plus /> : <X />}
                </span>
                <span>
                  <strong>{entry.group_name}</strong>
                  <small>
                    {entry.action === "joined"
                      ? "Entrou no grupo"
                      : "Saiu do grupo"}
                    {entry.role_title ? ` • ${entry.role_title}` : ""} •{" "}
                    {dateTime(entry.occurred_at)}
                  </small>
                </span>
              </div>
            ))}
            {!groupHistory.length && (
              <p className="inline-empty">
                Nenhuma participação em grupo registrada.
              </p>
            )}
          </section>
        </div>
      )}
      {tab === "consent" && (
        <section className="card consent-panel">
          <h2>Preferências e bases de consentimento</h2>
          <p>Autorizações expressas registradas para esta pessoa.</p>
          <div className="consent-grid">
            {consentLabels.map(([key, label]) => (
              <div
                className={person.consent[key] ? "allowed" : "denied"}
                key={key}
              >
                <span>{person.consent[key] ? <Check /> : <X />}</span>
                <strong>{label}</strong>
                <small>
                  {person.consent[key] ? "Autorizado" : "Não autorizado"}
                </small>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
function InfoCard({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Users;
  rows: [string, string | undefined][];
}) {
  return (
    <section className="card info-card">
      <h2>
        <Icon />
        {title}
      </h2>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || "Não informado"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
const consentLabels: [keyof Person["consent"], string][] = [
  ["data_processing", "Tratamento dos dados pessoais"],
  ["messaging", "Receber mensagens da igreja"],
  ["representatives_contact", "Contato por representantes"],
  ["event_photography", "Fotografia em eventos"],
  ["event_filming", "Filmagem em eventos"],
  ["social_media_image", "Uso de imagem nas redes sociais"],
  ["marketing", "Ações de comunicação e marketing"],
];

function PersonForm({
  churchId,
  initial,
  familyChildren,
  availablePeople,
  onClose,
  onSave,
  notify,
}: {
  churchId: string;
  initial?: Person;
  familyChildren: FamilyChildInput[];
  availablePeople: Person[];
  onClose: () => void;
  onSave: (p: Person, children: FamilyChildInput[]) => void;
  notify: (message: string, type?: "success" | "error") => void;
}) {
  const [form, setForm] = useState<Person>(
      initial
        ? {
            ...structuredClone(initial),
            birth_date: toBrazilianDate(initial.birth_date),
            phone_primary: maskPhone(initial.phone_primary ?? ""),
            phone_secondary: maskPhone(initial.phone_secondary ?? ""),
            children_names: initial.children_names ?? [],
          }
        : {
            id: newId(),
            church_id: churchId,
            full_name: "",
            address: { country: "Brasil" },
            categories: [],
            ministry_roles: [],
            group_ids: [],
            active: true,
            consent: { ...emptyConsent },
          },
    ),
    [section, setSection] = useState<"personal" | "church" | "consent">(
      "personal",
    ),
    [hasChildren, setHasChildren] = useState<boolean | undefined>(
      initial
        ? Boolean(initial.children_names?.length || familyChildren.length)
        : undefined,
    ),
    [children, setChildren] = useState<FamilyChildInput[]>(
      familyChildren.length
        ? familyChildren.map((child) => ({
            ...child,
            birth_date: toBrazilianDate(child.birth_date),
            document_cpf: maskCpf(child.document_cpf),
          }))
        : (initial?.children_names ?? []).map((full_name) => ({
            full_name,
            birth_date: "",
            gender: "",
            document_cpf: "",
          })),
    ),
    [, setFormError] = useState("");
  function showFormError(message: string) {
    setFormError(message);
    notify(message, "error");
  }
  const set = <K extends keyof Person>(key: K, value: Person[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    address = (key: keyof Person["address"], value: string) =>
      setForm((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      })),
    toggleList = (key: "categories", value: string) =>
      set(
        key,
        form[key].includes(value)
          ? form[key].filter((v) => v !== value)
          : [...form[key], value],
      );
  function continueForm(event: React.MouseEvent<HTMLButtonElement>) {
    setFormError("");
    const formElement = event.currentTarget.closest("form");
    if (!formElement?.reportValidity()) return;
    if (section === "personal") {
      if (!brazilianDateToIso(form.birth_date)) {
        showFormError("Informe uma data de nascimento válida em dd/mm/aaaa.");
        return;
      }
      if (hasChildren === undefined) {
        showFormError("Informe se a pessoa possui filhos.");
        return;
      }
      const childrenError = hasChildren ? familyChildrenError(children) : "";
      if (childrenError) {
        showFormError(childrenError);
        return;
      }
      const familyCpfs = [
        form.document_cpf?.replace(/\D/g, "") ?? "",
        ...children.map((child) => child.document_cpf.replace(/\D/g, "")),
      ];
      if (new Set(familyCpfs).size !== familyCpfs.length) {
        showFormError("Cada pessoa da família precisa ter um CPF diferente.");
        return;
      }
      if (!form.categories.length) {
        showFormError("Assinale Membro, Visitante, Adolescente ou Criança.");
        return;
      }
      setSection("consent");
      return;
    }
    if (!form.categories.length) {
      showFormError("Assinale Membro, Visitante, Adolescente ou Criança.");
      return;
    }
    setSection("consent");
  }
  return (
    <ModalShell
      title={initial ? "Editar pessoa" : "Nova pessoa"}
      subtitle="FICHA COMPLETA"
      onClose={onClose}
      large
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const birthDate = brazilianDateToIso(form.birth_date);
          if (!birthDate) {
            setSection("personal");
            showFormError("Informe uma data de nascimento válida.");
            return;
          }
          const childrenError = hasChildren
            ? familyChildrenError(children)
            : "";
          if (childrenError) {
            setSection("personal");
            showFormError(childrenError);
            return;
          }
          const preparedChildren = children.map((child) => ({
            ...child,
            full_name: child.full_name.trim(),
            birth_date: brazilianDateToIso(child.birth_date) ?? "",
            document_cpf: child.document_cpf.replace(/\D/g, ""),
          }));
          onSave(
            {
              ...form,
              birth_date: birthDate,
              children_names: preparedChildren.map((child) => child.full_name),
            },
            preparedChildren,
          );
        }}
      >
        <div className="form-tabs">
          <button
            type="button"
            className={section === "personal" ? "active" : ""}
            onClick={() => setSection("personal")}
          >
            1. Cadastro completo
          </button>
          <button
            type="button"
            className={section === "consent" ? "active" : ""}
            onClick={() => setSection("consent")}
          >
            2. Consentimentos
          </button>
        </div>
        <div className="form-scroll">
          {section === "personal" && (
            <>
              <FormSection title="Identificação">
                <div className="form-grid">
                  <Field
                    label="Nome completo"
                    required
                    value={form.full_name}
                    onChange={(v) => set("full_name", v)}
                  />
                  <Field
                    label="CPF"
                    required
                    value={form.document_cpf}
                    onChange={(v) => set("document_cpf", maskCpf(v))}
                  />
                  <Field
                    label="Data de nascimento"
                    required
                    placeholder="dd/mm/aaaa"
                    inputMode="numeric"
                    value={form.birth_date}
                    onChange={(v) => set("birth_date", maskBrazilianDate(v))}
                  />
                  <SelectField
                    label="Sexo"
                    required
                    value={form.gender}
                    options={["Homem", "Mulher", "Prefiro não informar"]}
                    onChange={(v) => set("gender", v)}
                  />
                  <SelectField
                    label="Escolaridade"
                    required
                    value={form.education}
                    options={[
                      "Ensino Fundamental",
                      "Ensino Médio",
                      "Ensino Superior",
                      "Pós-graduação",
                    ]}
                    onChange={(v) => set("education", v)}
                  />
                  <SelectField
                    label="Estado civil"
                    required
                    value={form.marital_status}
                    options={[
                      "Solteiro(a)",
                      "Casado(a)",
                      "Divorciado(a)",
                      "Viúvo(a)",
                      "União estável",
                    ]}
                    onChange={(v) => {
                      set("marital_status", v);
                      if (v !== "Casado(a)" && v !== "União estável")
                        set("spouse_name", undefined);
                    }}
                  />
                  {(form.marital_status === "Casado(a)" ||
                    form.marital_status === "União estável") && (
                    <Field
                      label="Nome completo do cônjuge"
                      required
                      value={form.spouse_name}
                      onChange={(v) => set("spouse_name", v)}
                    />
                  )}
                </div>
              </FormSection>
              <FormSection title="Filhos">
                <div className="form-grid">
                  <SelectField
                    label="Possui filhos?"
                    required
                    value={
                      hasChildren === undefined
                        ? ""
                        : hasChildren
                          ? "Sim"
                          : "Não"
                    }
                    options={["Sim", "Não"]}
                    onChange={(value) => {
                      const next = value === "Sim";
                      setHasChildren(value ? next : undefined);
                      setChildren(
                        next
                          ? children.length
                            ? children
                            : [
                                {
                                  full_name: "",
                                  birth_date: "",
                                  gender: "",
                                  document_cpf: "",
                                },
                              ]
                          : [],
                      );
                    }}
                  />
                </div>
                {hasChildren && (
                  <div className="children-name-list">
                    {children.map((child, index) => (
                      <div
                        className="family-child-card"
                        key={child.id ?? index}
                      >
                        <div className="family-child-heading">
                          <strong>Filho(a) {index + 1}</strong>
                          {children.length > 1 && (
                            <button
                              type="button"
                              className="icon-only danger"
                              aria-label={`Remover filho ${index + 1}`}
                              onClick={() =>
                                setChildren(
                                  children.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                            >
                              <Trash2 />
                            </button>
                          )}
                        </div>
                        <div className="form-grid">
                          <Field
                            label={`CPF do filho ${index + 1}`}
                            required
                            inputMode="numeric"
                            value={child.document_cpf}
                            onChange={(document_cpf) => {
                              const maskedCpf = maskCpf(document_cpf);
                              const cpfDigits = maskedCpf.replace(/\D/g, "");
                              const existingChild =
                                cpfDigits.length === 11
                                  ? availablePeople.find(
                                      (person) =>
                                        person.id !== initial?.id &&
                                        person.church_id === churchId &&
                                        person.document_cpf?.replace(
                                          /\D/g,
                                          "",
                                        ) === cpfDigits,
                                    )
                                  : undefined;
                              setChildren(
                                children.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? existingChild
                                      ? {
                                          id: existingChild.id,
                                          full_name: existingChild.full_name,
                                          birth_date: toBrazilianDate(
                                            existingChild.birth_date,
                                          ),
                                          gender: existingChild.gender ?? "",
                                          document_cpf: maskedCpf,
                                        }
                                      : { ...current, document_cpf: maskedCpf }
                                    : current,
                                ),
                              );
                              if (existingChild)
                                notify(
                                  `${existingChild.full_name} já está cadastrado(a). Ao salvar, esta pessoa será adicionada como outro responsável.`,
                                );
                            }}
                          />
                          <Field
                            label={`Nome completo do filho ${index + 1}`}
                            required
                            wide
                            value={child.full_name}
                            onChange={(full_name) =>
                              setChildren(
                                children.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? { ...current, full_name }
                                    : current,
                                ),
                              )
                            }
                          />
                          <Field
                            label={`Data de nascimento do filho ${index + 1}`}
                            required
                            placeholder="dd/mm/aaaa"
                            inputMode="numeric"
                            value={child.birth_date}
                            onChange={(birth_date) =>
                              setChildren(
                                children.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? {
                                        ...current,
                                        birth_date:
                                          maskBrazilianDate(birth_date),
                                      }
                                    : current,
                                ),
                              )
                            }
                          />
                          <SelectField
                            label={`Sexo do filho ${index + 1}`}
                            required
                            value={child.gender}
                            options={[
                              "Homem",
                              "Mulher",
                              "Prefiro não informar",
                            ]}
                            onChange={(gender) =>
                              setChildren(
                                children.map((current, itemIndex) =>
                                  itemIndex === index
                                    ? { ...current, gender }
                                    : current,
                                ),
                              )
                            }
                          />
                        </div>
                        {personAge(child.birth_date) !== null && (
                          <small className="child-age">
                            Idade atual: {personAge(child.birth_date)} anos
                          </small>
                        )}
                        {child.id && (
                          <small className="existing-child-notice">
                            <Check /> Cadastro existente localizado pelo CPF
                          </small>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="secondary add-child-name"
                      onClick={() =>
                        setChildren([
                          ...children,
                          {
                            full_name: "",
                            birth_date: "",
                            gender: "",
                            document_cpf: "",
                          },
                        ])
                      }
                    >
                      <Plus /> Adicionar outro filho
                    </button>
                  </div>
                )}
              </FormSection>
              <FormSection title="Contato">
                <div className="form-grid">
                  <Field
                    label="Telefone WhatsApp"
                    required
                    value={form.phone_primary}
                    onChange={(v) => set("phone_primary", maskPhone(v))}
                  />
                  <Field
                    label="Telefone alternativo (opcional)"
                    value={form.phone_secondary}
                    onChange={(v) => set("phone_secondary", maskPhone(v))}
                  />
                  <Field
                    label="E-mail"
                    type="email"
                    required
                    wide
                    value={form.email}
                    onChange={(v) => set("email", v)}
                  />
                </div>
              </FormSection>
              <FormSection title="Endereço">
                <div className="form-grid">
                  <CepField
                    required
                    value={form.address.zip}
                    onChange={(v) => address("zip", v)}
                    onAddress={(found) =>
                      setForm((current) => ({
                        ...current,
                        address: { ...current.address, ...found },
                      }))
                    }
                  />
                  <Field
                    label="Endereço"
                    wide
                    required
                    value={form.address.street}
                    onChange={(v) => address("street", v)}
                  />
                  <Field
                    label="Número"
                    required
                    value={form.address.number}
                    onChange={(v) => address("number", v)}
                  />
                  <Field
                    label="Complemento"
                    required
                    value={form.address.complement}
                    onChange={(v) => address("complement", v)}
                  />
                  <Field
                    label="Bairro"
                    required
                    value={form.address.district}
                    onChange={(v) => address("district", v)}
                  />
                  <Field
                    label="Cidade"
                    required
                    value={form.address.city}
                    onChange={(v) => address("city", v)}
                  />
                  <Field
                    label="Estado"
                    required
                    value={form.address.state}
                    onChange={(v) => address("state", v)}
                  />
                  <Field
                    label="País"
                    required
                    value={form.address.country}
                    onChange={(v) => address("country", v)}
                  />
                </div>
              </FormSection>
            </>
          )}
          {section === "personal" && (
            <>
              <FormSection title="Jornada espiritual">
                <div className="form-grid">
                  <Field
                    label="Data de conversão"
                    type="date"
                    value={form.conversion_date}
                    onChange={(v) => set("conversion_date", v)}
                  />
                  <Field
                    label="Data do batismo"
                    type="date"
                    value={form.baptism_date}
                    onChange={(v) => {
                      set("baptism_date", v);
                      set("baptized", v ? true : undefined);
                    }}
                  />
                </div>
              </FormSection>
              <FormSection title="Categorias" required>
                <div className="check-grid">
                  {["Criança", "Adolescente", "Visitante", "Membro"].map(
                    (v) => (
                      <CheckCard
                        key={v}
                        label={v}
                        checked={form.categories.includes(v)}
                        onChange={() => toggleList("categories", v)}
                      />
                    ),
                  )}
                </div>
              </FormSection>
              <label className="standalone-label">
                Informações complementares
                <textarea
                  rows={5}
                  placeholder="Informações que acha importante"
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </label>
              <CheckCard
                label="Cadastro ativo"
                checked={form.active}
                onChange={() => set("active", !form.active)}
              />
            </>
          )}
          {section === "consent" && (
            <>
              <div className="privacy-note">
                <ShieldCheck />
                <span>
                  <strong>Privacidade por padrão</strong>Marque somente
                  autorizações dadas de forma clara.
                </span>
              </div>
              <div className="consent-form">
                {consentLabels.map(([key, label]) => (
                  <label key={key}>
                    <span>
                      <strong>{label}</strong>
                      <small>
                        Pode ser alterado ou revogado a qualquer momento.
                      </small>
                    </span>
                    <input
                      type="checkbox"
                      checked={form.consent[key]}
                      onChange={() =>
                        setForm((prev) => ({
                          ...prev,
                          consent: {
                            ...prev.consent,
                            [key]: !prev.consent[key],
                          },
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          {section !== "consent" ? (
            <button
              key="continue"
              type="button"
              className="primary"
              onClick={continueForm}
            >
              Continuar <ChevronRight />
            </button>
          ) : (
            <button key="save" type="submit" className="primary">
              <Check />
              Salvar pessoa
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
}

function Kids({
  data,
  onAddChild,
  onAuthorization,
  onDailyAuthorization,
  onKidsGroup,
  onGenerate,
  onCheckIn,
  notify,
}: {
  data: WorkspaceData;
  onAddChild: () => void;
  onAuthorization: (authorization: ChildAuthorization) => void;
  onDailyAuthorization: (childId: string) => void;
  onKidsGroup: (group?: KidsGroup) => void;
  onGenerate: (eventId: string) => void;
  onCheckIn: (
    eventId: string,
    childId: string,
    guardianId: string,
    authorizationId: string | undefined,
    pickupCode: string,
  ) => void;
  notify: (message: string) => void;
}) {
  const services = data.events.filter(
    (event) => event.event_type === "worship",
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [tab, setTab] = useState<"children" | "groups" | "authorizations">(
    "groups",
  );
  const [selectedKidsGroupId, setSelectedKidsGroupId] = useState<string | null>(
    null,
  );
  const selectedService = services.find((event) => event.id === serviceId);
  const selectedKidsGroup = data.kidsGroups.find(
    (group) => group.id === selectedKidsGroupId,
  );
  const authorizations = data.childAuthorizations.filter(
    (item) => item.event_id === serviceId,
  );
  const childPerson = (childId: string) =>
    data.people.find((person) => person.id === childId);
  const guardianDetails = (childId: string) =>
    data.guardians
      .filter((guardian) => guardian.child_id === childId)
      .map((guardian) => ({
        ...guardian,
        person: data.people.find(
          (person) => person.id === guardian.guardian_person_id,
        ),
      }))
      .filter((guardian) => guardian.person);
  const guardianNames = (childId: string) => {
    const names = guardianDetails(childId).map(
      (guardian) => guardian.person?.full_name,
    );
    return names.length ? names.join(" e ") : "Responsável não vinculado";
  };
  async function copyAuthorization(authorization: ChildAuthorization) {
    const link = `${window.location.origin}${window.location.pathname}?authorization=${authorization.token}`;
    await navigator.clipboard.writeText(link);
    notify("Link de autorização copiado.");
  }
  return (
    <>
      <PageHead
        eyebrow="PROTEÇÃO E ACOLHIMENTO"
        title="Kids"
        text="Crianças, responsáveis e autorizações de uso de imagem em um único fluxo."
        action={tab === "groups" ? "Novo grupo Kids" : "Nova criança"}
        onAction={tab === "groups" ? () => onKidsGroup() : onAddChild}
      />
      <section className="kids-service-bar card">
        <div>
          <span className="metric-icon">
            <QrCode />
          </span>
          <label>
            Culto para autorização digital
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">Selecione um culto</option>
              {services.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title} — {dateTime(event.starts_at)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <button
            className="secondary"
            disabled={!serviceId}
            onClick={() => onGenerate(serviceId)}
          >
            <FileSignature />
            Gerar autorizações digitais
          </button>
        </div>
      </section>
      {!services.length && (
        <div className="kids-warning">
          <CalendarDays />
          <span>
            <strong>Nenhum culto cadastrado.</strong>Crie um evento do tipo
            Culto na Agenda para gerar autorizações.
          </span>
        </div>
      )}
      <div className="kids-metrics">
        <Metric
          icon={Baby}
          label="Crianças ativas"
          value={String(data.children.filter((child) => child.active).length)}
          detail="cadastros protegidos"
        />
        <Metric
          icon={FileSignature}
          label="Autorizações geradas"
          value={String(authorizations.length)}
          detail={selectedService?.title ?? "selecione um culto"}
        />
        <Metric
          icon={Camera}
          label="Imagem autorizada"
          value={String(
            authorizations.filter((item) => item.decision === "authorized")
              .length,
          )}
          detail="neste culto"
          positive
        />
      </div>
      <div className="detail-tabs kids-tabs">
        <button
          className={tab === "children" ? "active" : ""}
          onClick={() => setTab("children")}
        >
          Crianças
        </button>
        <button
          className={tab === "groups" ? "active" : ""}
          onClick={() => setTab("groups")}
        >
          Grupos Kids
        </button>
        <button
          className={tab === "authorizations" ? "active" : ""}
          onClick={() => setTab("authorizations")}
        >
          Autorizações por culto
        </button>
      </div>
      {tab === "children" && (
        <div className="children-grid">
          {data.children.map((child) => {
            const person = childPerson(child.person_id);
            const todayAuthorization = data.dailyChildAuthorizations.find(
              (item) =>
                item.child_id === child.person_id &&
                item.authorization_date === localDateIso(),
            );
            return (
              <article className="card child-card" key={child.person_id}>
                <div className="child-card-head">
                  <span className="profile-avatar small-profile">
                    {initials(person?.full_name ?? "Criança")}
                  </span>
                  <span>
                    <h2>{person?.full_name}</h2>
                    <small>
                      {person?.birth_date
                        ? `${ageFromDate(person.birth_date)} anos`
                        : "Idade não informada"}
                    </small>
                  </span>
                  <b className="status">Ativo</b>
                </div>
                <dl>
                  <div>
                    <dt>CPF</dt>
                    <dd>
                      {maskCpf(person?.document_cpf ?? "") || "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Nascimento</dt>
                    <dd>
                      {person?.birth_date
                        ? toBrazilianDate(person.birth_date)
                        : "Não informado"}
                    </dd>
                  </div>
                  <div>
                    <dt>Sexo</dt>
                    <dd>{person?.gender || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Responsáveis</dt>
                    <dd className="child-guardians">
                      {guardianDetails(child.person_id).length
                        ? guardianDetails(child.person_id).map((guardian) => (
                            <span key={guardian.id}>
                              <strong>{guardian.person?.full_name}</strong>
                              {guardian.relationship
                                ? ` • ${guardian.relationship}`
                                : ""}
                              {guardian.person?.phone_primary
                                ? ` • ${guardian.person.phone_primary}`
                                : ""}
                            </span>
                          ))
                        : "Responsável não vinculado"}
                    </dd>
                  </div>
                </dl>
                <button
                  className="secondary wide child-print-consent"
                  onClick={() => printGeneralChildConsent(child, data)}
                >
                  <Printer /> Gerar autorização do culto de hoje
                </button>
                <button
                  className={
                    todayAuthorization?.decision === "authorized"
                      ? "primary wide"
                      : "secondary wide"
                  }
                  onClick={() => onDailyAuthorization(child.person_id)}
                >
                  <FileSignature />
                  {todayAuthorization
                    ? todayAuthorization.decision === "authorized"
                      ? "Termo de hoje confirmado"
                      : "Termo de hoje: não autorizado"
                    : "Confirmar termo assinado"}
                </button>
              </article>
            );
          })}
          {!data.children.length && (
            <EmptyState
              icon={Baby}
              title="Nenhuma criança cadastrada"
              text="Cadastre a criança e vincule ao menos um responsável legal."
              action="Nova criança"
              onAction={onAddChild}
            />
          )}
        </div>
      )}
      {tab === "groups" && (
        <section>
          {selectedKidsGroup ? (
            <>
              <div className="section-action-row kids-group-detail-head">
                <div>
                  <button
                    className="text-action"
                    onClick={() => setSelectedKidsGroupId(null)}
                  >
                    <ArrowLeft /> Voltar para os grupos
                  </button>
                  <h2>{selectedKidsGroup.name}</h2>
                  <p>
                    Autorizações das crianças para{" "}
                    {selectedService?.title ?? "o culto selecionado"}.
                  </p>
                </div>
                <button
                  className="secondary"
                  onClick={() => onKidsGroup(selectedKidsGroup)}
                >
                  <Pencil /> Gerenciar grupo
                </button>
              </div>
              {!serviceId ? (
                <div className="kids-warning">
                  <CalendarDays />
                  <span>
                    <strong>Selecione um culto acima.</strong> Assim será
                    possível ver se o responsável autorizou cada criança.
                  </span>
                </div>
              ) : (
                <div className="card authorization-table kids-group-authorizations">
                  <div className="authorization-head">
                    <span>Criança, responsável e presença</span>
                    <span>Autorização do responsável</span>
                    <span>Escopo autorizado</span>
                    <span>Ações</span>
                  </div>
                  {selectedKidsGroup.member_ids.map((childId) => {
                    const authorization = authorizations.find(
                      (item) => item.child_id === childId,
                    );
                    const checkin = data.childCheckins.find(
                      (item) =>
                        item.event_id === serviceId &&
                        item.child_id === childId,
                    );
                    const primaryGuardian =
                      guardianDetails(childId).find(
                        (item) => item.primary_contact && item.can_pickup,
                      ) ??
                      guardianDetails(childId).find(
                        (item) => item.legal_guardian && item.can_pickup,
                      );
                    return (
                      <div className="authorization-row" key={childId}>
                        <span className="person-cell">
                          <span className="avatar blue">
                            {initials(childPerson(childId)?.full_name ?? "C")}
                          </span>
                          <span>
                            <strong>
                              {childPerson(childId)?.full_name ?? "Criança"}
                            </strong>
                            <small>{guardianNames(childId)}</small>
                            {checkin && (
                              <small className="kids-present-status">
                                <ClipboardCheck /> Presente desde{" "}
                                {dateTime(checkin.checkin_at)}
                                {checkin.pickup_code
                                  ? ` • retirada ${checkin.pickup_code}`
                                  : ""}
                              </small>
                            )}
                          </span>
                        </span>
                        <span>
                          {authorization ? (
                            <>
                              <b
                                className={`authorization-status ${authorization.decision}`}
                              >
                                {authorizationDecisionForGuardian(
                                  authorization.decision,
                                )}
                              </b>
                              {authorization.signed_at && (
                                <small>
                                  {dateTime(authorization.signed_at)}
                                </small>
                              )}
                            </>
                          ) : (
                            <b className="authorization-status not-generated">
                              Autorização não gerada
                            </b>
                          )}
                        </span>
                        <span className="scope-icons">
                          <i
                            className={authorization?.allow_photo ? "on" : ""}
                            title="Fotografia"
                          >
                            <Camera />
                          </i>
                          <i
                            className={authorization?.allow_video ? "on" : ""}
                            title="Vídeo"
                          >
                            <Video />
                          </i>
                          <i
                            className={
                              authorization?.allow_social_media ? "on" : ""
                            }
                            title="Redes sociais"
                          >
                            <Share2 />
                          </i>
                        </span>
                        <span className="row-actions">
                          {authorization ? (
                            <>
                              <button
                                className="secondary compact"
                                onClick={() => copyAuthorization(authorization)}
                              >
                                <Share2 /> Copiar autorização
                              </button>
                              <button
                                className="secondary compact"
                                onClick={() =>
                                  downloadChildAuthorization(
                                    authorization,
                                    data,
                                  )
                                }
                              >
                                <Download /> Baixar termo
                              </button>
                              <button
                                className="secondary compact"
                                onClick={() =>
                                  printChildAuthorization(authorization, data)
                                }
                              >
                                <Printer /> Imprimir termo
                              </button>
                              <button
                                className="secondary compact"
                                onClick={() => onAuthorization(authorization)}
                              >
                                {authorization.decision === "pending"
                                  ? "Registrar"
                                  : "Revisar"}
                              </button>
                            </>
                          ) : (
                            <button
                              className="secondary compact"
                              onClick={() => onGenerate(serviceId)}
                            >
                              <FileSignature /> Gerar autorizações
                            </button>
                          )}
                          {!checkin && (
                            <button
                              className="primary compact"
                              disabled={!primaryGuardian}
                              title={
                                primaryGuardian
                                  ? "Registrar presença"
                                  : "Vincule um responsável autorizado para registrar a presença"
                              }
                              onClick={() => {
                                if (!primaryGuardian) return;
                                const pickupCode = String(
                                  Math.floor(1000 + Math.random() * 9000),
                                );
                                onCheckIn(
                                  serviceId,
                                  childId,
                                  primaryGuardian.guardian_person_id,
                                  authorization?.id,
                                  pickupCode,
                                );
                              }}
                            >
                              <ClipboardCheck /> Dar presença
                            </button>
                          )}
                        </span>
                      </div>
                    );
                  })}
                  {!selectedKidsGroup.member_ids.length && (
                    <p className="inline-empty">
                      Este grupo ainda não possui crianças.
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-action-row">
                <div>
                  <h2>Grupos de crianças</h2>
                  <p>Organize as crianças por turma, idade ou necessidade.</p>
                </div>
              </div>
              <div className="children-grid">
                {data.kidsGroups.map((group) => (
                  <article className="card child-card" key={group.id}>
                    <div className="child-card-head">
                      <span className="profile-avatar small-profile">
                        <Users />
                      </span>
                      <span>
                        <h2>{group.name}</h2>
                        <small>
                          {group.min_age !== undefined ||
                          group.max_age !== undefined
                            ? `${group.min_age ?? 0} a ${group.max_age ?? 17} anos`
                            : "Todas as idades"}
                        </small>
                      </span>
                      <b
                        className={`status ${!group.active ? "inactive" : ""}`}
                      >
                        {group.active ? "Ativo" : "Inativo"}
                      </b>
                    </div>
                    <p>{group.description || "Sem descrição."}</p>
                    <div className="kids-group-count">
                      <strong>{group.member_ids.length}</strong>
                      <span>crianças selecionadas</span>
                    </div>
                    <div className="role-chips">
                      {group.member_ids.slice(0, 5).map((childId) => (
                        <span key={childId}>
                          {childPerson(childId)?.full_name ?? "Criança"}
                        </span>
                      ))}
                    </div>
                    <button
                      className="primary wide"
                      onClick={() => setSelectedKidsGroupId(group.id)}
                    >
                      <FileSignature /> Ver crianças e autorizações
                    </button>
                    <button
                      className="secondary wide"
                      onClick={() => onKidsGroup(group)}
                    >
                      <Pencil /> Gerenciar grupo
                    </button>
                  </article>
                ))}
                {!data.kidsGroups.length && (
                  <EmptyState
                    icon={Users}
                    title="Nenhum grupo Kids criado"
                    text="Crie um grupo e escolha as crianças participantes."
                    action="Criar primeiro grupo"
                    onAction={() => onKidsGroup()}
                  />
                )}
              </div>
            </>
          )}
        </section>
      )}
      {tab === "authorizations" && (
        <section className="card authorization-table">
          <div className="authorization-head">
            <span>Criança e responsável</span>
            <span>Decisão</span>
            <span>Escopo autorizado</span>
            <span>Ações</span>
          </div>
          {authorizations.map((authorization) => (
            <div className="authorization-row" key={authorization.id}>
              <span className="person-cell">
                <span className="avatar blue">
                  {initials(
                    childPerson(authorization.child_id)?.full_name ?? "C",
                  )}
                </span>
                <span>
                  <strong>
                    {childPerson(authorization.child_id)?.full_name}
                  </strong>
                  <small>{guardianNames(authorization.child_id)}</small>
                </span>
              </span>
              <span>
                <b className={`authorization-status ${authorization.decision}`}>
                  {authorizationDecision(authorization.decision)}
                </b>
                {authorization.signed_at && (
                  <small>{dateTime(authorization.signed_at)}</small>
                )}
              </span>
              <span className="scope-icons">
                <i
                  className={authorization.allow_photo ? "on" : ""}
                  title="Fotografia"
                >
                  <Camera />
                </i>
                <i
                  className={authorization.allow_video ? "on" : ""}
                  title="Vídeo"
                >
                  <Video />
                </i>
                <i
                  className={authorization.allow_social_media ? "on" : ""}
                  title="Redes sociais"
                >
                  <Share2 />
                </i>
              </span>
              <span className="row-actions">
                <button
                  className="icon-only"
                  title="Copiar link para o responsável"
                  onClick={() => copyAuthorization(authorization)}
                >
                  <Share2 />
                </button>
                <button
                  className="icon-only"
                  title="Imprimir autorização"
                  onClick={() => printChildAuthorization(authorization, data)}
                >
                  <Printer />
                </button>
                <button
                  className="icon-only"
                  title="Baixar autorização"
                  onClick={() =>
                    downloadChildAuthorization(authorization, data)
                  }
                >
                  <Download />
                </button>
                <button
                  className="secondary compact"
                  onClick={() => onAuthorization(authorization)}
                >
                  {authorization.decision === "pending"
                    ? "Registrar"
                    : "Revisar"}
                </button>
              </span>
            </div>
          ))}
          {serviceId && !authorizations.length && (
            <p className="inline-empty">
              Clique em “Gerar autorizações digitais” para criar uma autorização
              individual para cada criança.
            </p>
          )}
        </section>
      )}
    </>
  );
}

function authorizationDecision(decision: ChildAuthorization["decision"]) {
  return {
    pending: "Pendente",
    authorized: "Autorizado",
    denied: "Não autorizado",
    revoked: "Revogado",
  }[decision];
}
function authorizationDecisionForGuardian(
  decision: ChildAuthorization["decision"],
) {
  return {
    pending: "Aguardando o responsável",
    authorized: "Responsável autorizou",
    denied: "Responsável não autorizou",
    revoked: "Autorização revogada",
  }[decision];
}
function ageFromDate(date: string) {
  const today = new Date(),
    birth = new Date(`${date}T12:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()))
    age--;
  return age;
}
function localDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function printGeneralChildConsent(profile: ChildProfile, data: WorkspaceData) {
  const child = data.people.find((person) => person.id === profile.person_id);
  const church = data.churches.find((item) => item.id === profile.church_id);
  const generatedAt = new Date();
  const documentDate = generatedAt.toLocaleDateString("pt-BR");
  const todayService = data.events.find((event) => {
    const eventDate = new Date(event.starts_at);
    return (
      event.event_type === "worship" &&
      eventDate.getFullYear() === generatedAt.getFullYear() &&
      eventDate.getMonth() === generatedAt.getMonth() &&
      eventDate.getDate() === generatedAt.getDate()
    );
  });
  const popup = window.open("", "_blank", "width=820,height=900");
  if (!popup) return;
  const safe = (value?: string) =>
    (value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char] ?? char,
    );
  const birthDate = child?.birth_date
    ? new Date(`${child.birth_date}T12:00:00`).toLocaleDateString("pt-BR")
    : "Não informada";
  const guardianRows = guardianDocumentRows(profile.person_id, data, safe);
  const signatureRows = guardianSignatureRows(profile.person_id, data, safe);
  popup.document
    .write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Autorização Kids — ${safe(child?.full_name)}</title><style>
    @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172b27;margin:0;line-height:1.48}header{border-bottom:3px solid #177356;padding-bottom:14px;margin-bottom:20px}h1{font-size:21px;margin:0 0 4px}h2{font-size:14px;margin:20px 0 8px}.muted{color:#5d6f69}.box{border:1px solid #cad7d2;border-radius:9px;padding:12px 16px;margin:12px 0}.box p{margin:5px 0}.choices{display:grid;gap:8px;margin:12px 0}.choice{border:1px solid #cad7d2;border-radius:8px;padding:9px 12px}.notice{padding:11px 13px;background:#f4f8f6;border-radius:8px}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-top:52px}.signature{border-top:1px solid #172b27;padding-top:6px}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #d9e2df;font-size:10px;color:#5d6f69}button{margin-top:18px;padding:10px 18px}@media print{button{display:none}}
  </style></head><body><header><h1>Termo físico de autorização de uso de imagem</h1><div class="muted">Válido exclusivamente para o culto de ${safe(documentDate)}</div></header>
  <div class="box"><p><strong>Igreja:</strong> ${safe(church?.name)}</p><p><strong>Culto:</strong> ${safe(todayService?.title || "Culto do dia")} — ${safe(documentDate)}</p><p><strong>Criança/adolescente:</strong> ${safe(child?.full_name)}</p><p><strong>CPF:</strong> ${safe(formatCpfForDocument(child?.document_cpf))}</p><p><strong>Data de nascimento:</strong> ${safe(birthDate)}</p>${guardianRows}</div>
  <h2>Manifestação do responsável</h2><p>Declaro ser pai, mãe ou responsável legal pela criança ou adolescente acima identificado e que recebi informações claras sobre a captação e o uso de sua imagem exclusivamente durante o culto realizado nesta data.</p>
  <div class="choices"><div class="choice">☐ AUTORIZO fotografias durante o culto de ${safe(documentDate)}.</div><div class="choice">☐ AUTORIZO gravações em vídeo durante o culto de ${safe(documentDate)}.</div><div class="choice">☐ AUTORIZO a publicação das imagens deste culto nos canais e redes sociais oficiais da igreja.</div><div class="choice">☐ NÃO AUTORIZO a captação nem a publicação de imagem.</div></div>
  <p class="notice"><strong>Validade:</strong> somente para o culto de ${safe(documentDate)}. Este termo não autoriza o uso de imagem em cultos ou eventos futuros. A participação da criança ou adolescente não depende desta autorização. O documento deverá ser arquivado fisicamente pela igreja.</p>
  <h2>Assinaturas dos responsáveis</h2><div class="signature-grid">${signatureRows}</div>
  <div class="footer">Ficha vinculada: ${safe(profile.person_id)} • Documento gerado em ${safe(generatedAt.toLocaleString("pt-BR"))}</div>
  <button onclick="window.print()">Imprimir / salvar em PDF</button></body></html>`);
  popup.document.close();
  popup.focus();
}
function formatCpfForDocument(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits.length === 11
    ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
    : (value ?? "Não informado");
}
function documentLocationDate(date = new Date()) {
  return `Carlos Barbosa, ${date.toLocaleDateString("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}
function childLegalGuardians(childId: string, data: WorkspaceData) {
  return data.guardians
    .filter(
      (guardian) => guardian.child_id === childId && guardian.legal_guardian,
    )
    .sort(
      (left, right) =>
        Number(right.primary_contact) - Number(left.primary_contact),
    )
    .map((guardian) => ({
      ...guardian,
      person: data.people.find(
        (person) => person.id === guardian.guardian_person_id,
      ),
    }))
    .filter((guardian) => guardian.person);
}
function guardianDocumentRows(
  childId: string,
  data: WorkspaceData,
  safe: (value?: string) => string,
) {
  const guardians = childLegalGuardians(childId, data);
  if (!guardians.length)
    return "<p><strong>Responsáveis legais:</strong> Não vinculados</p>";
  return guardians
    .map(
      (guardian, index) =>
        `<div class="guardian"><strong>Responsável legal ${index + 1}:</strong> ${safe(guardian.person?.full_name)}${guardian.relationship ? ` — ${safe(guardian.relationship)}` : ""}<br><span>CPF: ${safe(formatCpfForDocument(guardian.person?.document_cpf))} • Telefone: ${safe(guardian.person?.phone_primary || "Não informado")}</span></div>`,
    )
    .join("");
}
function guardianSignatureRows(
  childId: string,
  data: WorkspaceData,
  safe: (value?: string) => string,
) {
  const guardians = childLegalGuardians(childId, data);
  const signatures = guardians.length
    ? guardians
        .map(
          (guardian) =>
            `<div class="signature">Assinatura de ${safe(guardian.person?.full_name)} — ${safe(guardian.relationship || "Responsável legal")}</div>`,
        )
        .join("")
    : '<div class="signature">Assinatura do responsável legal</div>';
  return `${signatures}<div class="signature">${safe(documentLocationDate())}</div>`;
}
function printChildAuthorization(
  authorization: ChildAuthorization,
  data: WorkspaceData,
) {
  const child = data.people.find(
      (person) => person.id === authorization.child_id,
    ),
    event = data.events.find((item) => item.id === authorization.event_id),
    church = data.churches.find((item) => item.id === authorization.church_id),
    popup = window.open("", "_blank", "width=820,height=900");
  if (!popup) return;
  const safe = (value?: string) =>
    (value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char] ?? char,
    );
  const pending = authorization.decision === "pending";
  const guardianRows = guardianDocumentRows(authorization.child_id, data, safe);
  const signatureRows = guardianSignatureRows(
    authorization.child_id,
    data,
    safe,
  );
  popup.document
    .write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Termo de consentimento Kids</title><style>
    @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px Arial,sans-serif;color:#172b27;margin:0;line-height:1.5}header{border-bottom:3px solid #177356;padding-bottom:16px;margin-bottom:24px}h1{font-size:22px;margin:0 0 5px}h2{font-size:15px;margin:24px 0 10px}.muted{color:#5d6f69}.box{border:1px solid #cad7d2;border-radius:10px;padding:14px 18px;margin:14px 0}.box p{margin:6px 0}.guardian{margin-top:10px;padding-top:10px;border-top:1px solid #e2e9e6}.guardian span{color:#5d6f69;font-size:12px}.decision{padding:12px 16px;border-radius:8px;background:${pending ? "#fff5df" : authorization.decision === "authorized" ? "#e5f5ed" : "#fbe7e4"};font-weight:bold}.scopes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.scope{border:1px solid #cad7d2;border-radius:8px;padding:10px}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:62px}.signature{border-top:1px solid #172b27;padding-top:7px}.code{margin-top:28px;padding-top:12px;border-top:1px solid #d9e2df;font:11px monospace;color:#5d6f69}button{margin-top:24px;padding:10px 18px}@media print{button{display:none}}
  </style></head><body><header><h1>${pending ? "Termo para manifestação de consentimento" : "Comprovante de consentimento específico"}</h1><div class="muted">Uso de imagem de criança ou adolescente em culto</div></header>
  <div class="box"><p><strong>Igreja:</strong> ${safe(church?.name)}</p><p><strong>Criança/adolescente:</strong> ${safe(child?.full_name)}</p><p><strong>CPF:</strong> ${safe(formatCpfForDocument(child?.document_cpf))}</p><p><strong>Data de nascimento:</strong> ${safe(child?.birth_date ? new Date(`${child.birth_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada")}</p><p><strong>Culto:</strong> ${safe(event?.title)} — ${safe(event ? dateTime(event.starts_at) : "")}</p>${guardianRows}</div>
  <h2>Finalidade e condições</h2><p>${safe(authorization.consent_text_snapshot)}</p><p class="muted">A decisão é exclusiva para o culto identificado acima. A participação da criança não depende da autorização de imagem. O responsável poderá solicitar a revogação conforme a legislação aplicável.</p>
  <h2>Decisão e escopos</h2><div class="decision">${pending ? "☐ AUTORIZO   ☐ NÃO AUTORIZO" : authorizationDecision(authorization.decision).toUpperCase()}</div><div class="scopes"><div class="scope">${authorization.allow_photo ? "☑" : "☐"} Fotografia</div><div class="scope">${authorization.allow_video ? "☑" : "☐"} Gravação em vídeo</div><div class="scope">${authorization.allow_social_media ? "☑" : "☐"} Publicação nas redes sociais</div></div>
  <h2>Assinaturas dos responsáveis</h2><div class="signature-grid">${signatureRows}</div>
  <div class="code">Documento: ${safe(authorization.id)}<br>Versão do consentimento: ${safe(authorization.consent_version)}<br>${authorization.signed_at ? `Registro eletrônico: ${safe(dateTime(authorization.signed_at))}` : "Documento ainda sem manifestação registrada no sistema."}</div>
  <button onclick="window.print()">Imprimir / salvar em PDF</button></body></html>`);
  popup.document.close();
  popup.focus();
}

function downloadChildAuthorization(
  authorization: ChildAuthorization,
  data: WorkspaceData,
) {
  const child = data.people.find(
    (person) => person.id === authorization.child_id,
  );
  const event = data.events.find((item) => item.id === authorization.event_id);
  const church = data.churches.find(
    (item) => item.id === authorization.church_id,
  );
  const safe = (value?: string) =>
    (value ?? "").replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[char] ?? char,
    );
  const pending = authorization.decision === "pending";
  const guardianRows = guardianDocumentRows(authorization.child_id, data, safe);
  const signatureRows = guardianSignatureRows(
    authorization.child_id,
    data,
    safe,
  );
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Autorização Kids — ${safe(child?.full_name)}</title><style>
  @page{size:A4;margin:18mm}*{box-sizing:border-box}body{max-width:800px;margin:32px auto;padding:0 24px;font:14px Arial,sans-serif;color:#172b27;line-height:1.5}header{border-bottom:3px solid #177356;padding-bottom:16px;margin-bottom:24px}h1{font-size:22px;margin:0 0 5px}h2{font-size:15px;margin:24px 0 10px}.muted{color:#5d6f69}.box{border:1px solid #cad7d2;border-radius:10px;padding:14px 18px;margin:14px 0}.box p{margin:6px 0}.guardian{margin-top:10px;padding-top:10px;border-top:1px solid #e2e9e6}.guardian span{color:#5d6f69;font-size:12px}.decision{padding:12px 16px;border-radius:8px;background:${pending ? "#fff5df" : authorization.decision === "authorized" ? "#e5f5ed" : "#fbe7e4"};font-weight:bold}.scopes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.scope{border:1px solid #cad7d2;border-radius:8px;padding:10px}.signature-grid{display:grid;grid-template-columns:1fr 1fr;gap:36px 24px;margin-top:52px}.signature{border-top:1px solid #172b27;padding-top:7px}.code{margin-top:28px;padding-top:12px;border-top:1px solid #d9e2df;font:11px monospace;color:#5d6f69}button{margin-top:24px;padding:11px 18px;border:0;border-radius:8px;color:white;background:#177356;font-weight:bold;cursor:pointer}@media print{body{margin:0;padding:0}button{display:none}}
  </style></head><body><header><h1>${pending ? "Termo para manifestação de consentimento" : "Comprovante de consentimento específico"}</h1><div class="muted">Uso de imagem de criança ou adolescente em culto</div></header>
  <div class="box"><p><strong>Igreja:</strong> ${safe(church?.name)}</p><p><strong>Criança/adolescente:</strong> ${safe(child?.full_name)}</p><p><strong>CPF:</strong> ${safe(formatCpfForDocument(child?.document_cpf))}</p><p><strong>Culto:</strong> ${safe(event?.title)} — ${safe(event ? dateTime(event.starts_at) : "")}</p>${guardianRows}</div>
  <h2>Finalidade e condições</h2><p>${safe(authorization.consent_text_snapshot)}</p><p class="muted">A decisão é exclusiva para o culto identificado acima. A participação da criança não depende da autorização de imagem.</p>
  <h2>Decisão e escopos</h2><div class="decision">${pending ? "☐ AUTORIZO   ☐ NÃO AUTORIZO" : authorizationDecision(authorization.decision).toUpperCase()}</div><div class="scopes"><div class="scope">${authorization.allow_photo ? "☑" : "☐"} Fotografia</div><div class="scope">${authorization.allow_video ? "☑" : "☐"} Vídeo</div><div class="scope">${authorization.allow_social_media ? "☑" : "☐"} Redes sociais</div></div>
  <h2>Assinaturas dos responsáveis</h2><div class="signature-grid">${signatureRows}</div>
  <div class="code">Documento: ${safe(authorization.id)}<br>Versão: ${safe(authorization.consent_version)}<br>${authorization.signed_at ? `Registro eletrônico: ${safe(dateTime(authorization.signed_at))}` : "Documento ainda sem manifestação registrada."}</div><button onclick="window.print()">Imprimir / salvar em PDF</button></body></html>`;
  const blobUrl = URL.createObjectURL(
    new Blob([html], { type: "text/html;charset=utf-8" }),
  );
  const link = document.createElement("a");
  const childName = (child?.full_name ?? "crianca")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  link.href = blobUrl;
  link.download = `autorizacao-kids-${childName || "crianca"}.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(blobUrl);
}

function ChildForm({
  churchId,
  people,
  profiles,
  onClose,
  onSave,
}: {
  churchId: string;
  people: Person[];
  profiles: ChildProfile[];
  onClose: () => void;
  onSave: (
    person: Person,
    profile: ChildProfile,
    guardianId?: string,
    relationship?: string,
  ) => void;
}) {
  const [form, setForm] = useState({
    fullName: "",
    birthDate: "",
    gender: "",
    documentCpf: "",
    guardianId: "",
    relationship: "Mãe",
  });
  const [error, setError] = useState("");
  return (
    <ModalShell
      title="Nova criança"
      subtitle="KIDS • CADASTRO PROTEGIDO"
      onClose={onClose}
      large
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const cpf = form.documentCpf.replace(/\D/g, "");
          const existingPerson = people.find(
            (person) =>
              person.church_id === churchId &&
              person.document_cpf?.replace(/\D/g, "") === cpf,
          );
          const guardian = people.find(
            (person) => person.id === form.guardianId,
          );
          const birthAge = ageFromDate(form.birthDate);
          if (cpf.length !== 11)
            return setError("Informe um CPF com 11 números.");
          if (birthAge < 0 || birthAge >= 18)
            return setError(
              "O cadastro Kids aceita somente menores de 18 anos.",
            );
          const personId = existingPerson?.id ?? newId(),
            person: Person = {
              ...(existingPerson ?? {}),
              id: personId,
              church_id: churchId,
              full_name: form.fullName,
              birth_date: form.birthDate,
              gender: form.gender,
              document_cpf: cpf,
              address: existingPerson?.address ?? { country: "Brasil" },
              categories: [
                ...new Set([
                  ...(existingPerson?.categories ?? []),
                  "Criança",
                  ...(birthAge >= 12 ? ["Adolescente"] : []),
                ]),
              ],
              ministry_roles: existingPerson?.ministry_roles ?? [],
              group_ids: existingPerson?.group_ids ?? [],
              active: true,
              consent: existingPerson?.consent ??
                guardian?.consent ?? {
                  ...emptyConsent,
                  data_processing: true,
                },
            },
            profile: ChildProfile = {
              ...(profiles.find((item) => item.person_id === personId) ?? {}),
              person_id: personId,
              church_id: churchId,
              emergency_contact_name: guardian?.full_name ?? "",
              emergency_contact_phone: guardian?.phone_primary ?? "",
              authorized_pickup_people:
                profiles.find((item) => item.person_id === personId)
                  ?.authorized_pickup_people ?? [],
              pickup_code_required: true,
              active: true,
            };
          onSave(
            person,
            profile,
            form.guardianId || undefined,
            form.relationship,
          );
        }}
      >
        <div className="form-scroll">
          <div className="kids-warning">
            <ShieldCheck />
            <span>
              <strong>Dados de menor de idade</strong>Vincule um responsável
              legal. A autorização de imagem não é permanente: será gerada
              novamente para cada culto.
            </span>
          </div>
          <FormSection title="Identificação da criança">
            <div className="form-grid">
              <Field
                label="CPF"
                required
                inputMode="numeric"
                value={form.documentCpf}
                onChange={(value) => {
                  const documentCpf = maskCpf(value);
                  const cpf = documentCpf.replace(/\D/g, "");
                  const existing =
                    cpf.length === 11
                      ? people.find(
                          (person) =>
                            person.church_id === churchId &&
                            person.document_cpf?.replace(/\D/g, "") === cpf,
                        )
                      : undefined;
                  setForm({
                    ...form,
                    documentCpf,
                    ...(existing
                      ? {
                          fullName: existing.full_name,
                          birthDate: existing.birth_date ?? "",
                          gender: existing.gender ?? "",
                        }
                      : {}),
                  });
                  setError(
                    existing
                      ? "Criança localizada. Selecione o responsável para criar apenas o novo vínculo."
                      : "",
                  );
                }}
              />
              <Field
                label="Nome completo"
                wide
                required
                value={form.fullName}
                onChange={(value) => setForm({ ...form, fullName: value })}
              />
              <SelectField
                label="Sexo"
                required
                value={form.gender}
                options={["Homem", "Mulher", "Prefiro não informar"]}
                onChange={(value) => setForm({ ...form, gender: value })}
              />
              <Field
                label="Data de nascimento"
                type="date"
                required
                value={form.birthDate}
                onChange={(value) => setForm({ ...form, birthDate: value })}
              />
            </div>
          </FormSection>
          <FormSection title="Responsável legal">
            <div className="form-grid">
              <SelectField
                label="Pessoa responsável"
                value={form.guardianId}
                raw
                required
                options={people
                  .filter((person) => !person.categories.includes("Criança"))
                  .map((person) => `${person.id}|${person.full_name}`)}
                onChange={(value) => setForm({ ...form, guardianId: value })}
              />
              <SelectField
                label="Parentesco"
                value={form.relationship}
                options={[
                  "Mãe",
                  "Pai",
                  "Avó",
                  "Avô",
                  "Tutor(a)",
                  "Responsável legal",
                ]}
                onChange={(value) => setForm({ ...form, relationship: value })}
              />
            </div>
          </FormSection>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function ChildAuthorizationForm({
  authorization,
  data,
  onClose,
  onSave,
}: {
  authorization: ChildAuthorization;
  data: WorkspaceData;
  onClose: () => void;
  onSave: (authorization: ChildAuthorization) => void;
}) {
  const child = data.people.find(
      (person) => person.id === authorization.child_id,
    ),
    event = data.events.find((item) => item.id === authorization.event_id),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      decision:
        authorization.decision === "pending"
          ? ("authorized" as ChildAuthorization["decision"])
          : authorization.decision,
      photo: authorization.allow_photo,
      video: authorization.allow_video,
      social: authorization.allow_social_media,
      signedName: authorization.signed_name ?? "",
    });
  return (
    <ModalShell
      title="Autorização por culto"
      subtitle="USO DE IMAGEM • CRIANÇA"
      onClose={onClose}
    >
      <form
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          if (form.signedName.trim().length < 3) {
            setError("Informe o nome completo do responsável legal.");
            return;
          }
          if (
            form.decision === "authorized" &&
            !form.photo &&
            !form.video &&
            !form.social
          ) {
            setError("Selecione ao menos uma finalidade autorizada.");
            return;
          }
          setError("");
          onSave({
            ...authorization,
            decision: form.decision,
            allow_photo: form.decision === "authorized" && form.photo,
            allow_video: form.decision === "authorized" && form.video,
            allow_social_media: form.decision === "authorized" && form.social,
            signed_name: form.signedName,
            signed_at: new Date().toISOString(),
          });
        }}
      >
        <div className="form-scroll">
          <div className="authorization-summary">
            <span className="profile-avatar small-profile">
              {initials(child?.full_name ?? "C")}
            </span>
            <span>
              <strong>{child?.full_name}</strong>
              <small>
                {event?.title} • {event ? dateTime(event.starts_at) : ""}
              </small>
            </span>
          </div>
          <p className="consent-copy">{authorization.consent_text_snapshot}</p>
          <div className="decision-switch">
            <button
              type="button"
              className={form.decision === "authorized" ? "allow active" : ""}
              onClick={() => setForm({ ...form, decision: "authorized" })}
            >
              <Check />
              Autorizar neste culto
            </button>
            <button
              type="button"
              className={form.decision === "denied" ? "deny active" : ""}
              onClick={() =>
                setForm({
                  ...form,
                  decision: "denied",
                  photo: false,
                  video: false,
                  social: false,
                })
              }
            >
              <X />
              Não autorizar
            </button>
          </div>
          {form.decision === "authorized" && (
            <div className="scope-choice">
              <CheckCard
                label="Fotografia durante o culto"
                checked={form.photo}
                onChange={() => setForm({ ...form, photo: !form.photo })}
              />
              <CheckCard
                label="Gravação em vídeo"
                checked={form.video}
                onChange={() => setForm({ ...form, video: !form.video })}
              />
              <CheckCard
                label="Publicação nas redes sociais"
                checked={form.social}
                onChange={() => setForm({ ...form, social: !form.social })}
              />
            </div>
          )}
          <Field
            label="Nome completo do responsável que manifestou a decisão"
            wide
            required
            value={form.signedName}
            onChange={(value) => setForm({ ...form, signedName: value })}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function KidsGroupForm({
  churchId,
  data,
  initial,
  onClose,
  onSave,
}: {
  churchId: string;
  data: WorkspaceData;
  initial?: KidsGroup;
  onClose: () => void;
  onSave: (group: KidsGroup) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    minAge: initial?.min_age?.toString() ?? "",
    maxAge: initial?.max_age?.toString() ?? "",
    active: initial?.active ?? true,
    memberIds: initial?.member_ids ?? [],
  });
  return (
    <ModalShell
      title={initial ? "Gerenciar grupo Kids" : "Novo grupo Kids"}
      subtitle="TURMAS DO MINISTÉRIO INFANTIL"
      onClose={onClose}
      large
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: initial?.id ?? newId(),
            church_id: churchId,
            name: form.name,
            description: form.description,
            min_age: form.minAge === "" ? undefined : Number(form.minAge),
            max_age: form.maxAge === "" ? undefined : Number(form.maxAge),
            active: form.active,
            member_ids: form.memberIds,
          });
        }}
      >
        <div className="form-scroll">
          <FormSection title="Informações do grupo">
            <div className="form-grid">
              <Field
                label="Nome do grupo"
                required
                wide
                value={form.name}
                onChange={(name) => setForm({ ...form, name })}
              />
              <Field
                label="Idade mínima"
                type="number"
                value={form.minAge}
                onChange={(minAge) => setForm({ ...form, minAge })}
              />
              <Field
                label="Idade máxima"
                type="number"
                value={form.maxAge}
                onChange={(maxAge) => setForm({ ...form, maxAge })}
              />
              <label className="full">
                Descrição
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </label>
            </div>
          </FormSection>
          <FormSection title="Crianças do grupo">
            <div className="check-grid kids-member-picker">
              {data.children
                .filter((profile) => profile.active)
                .map((profile) => {
                  const person = data.people.find(
                    (item) => item.id === profile.person_id,
                  );
                  return (
                    <CheckCard
                      key={profile.person_id}
                      label={`${person?.full_name ?? "Criança"}${person?.birth_date ? ` • ${ageFromDate(person.birth_date)} anos` : ""}`}
                      checked={form.memberIds.includes(profile.person_id)}
                      onChange={() =>
                        setForm({
                          ...form,
                          memberIds: form.memberIds.includes(profile.person_id)
                            ? form.memberIds.filter(
                                (id) => id !== profile.person_id,
                              )
                            : [...form.memberIds, profile.person_id],
                        })
                      }
                    />
                  );
                })}
            </div>
          </FormSection>
          <CheckCard
            label="Grupo ativo"
            checked={form.active}
            onChange={() => setForm({ ...form, active: !form.active })}
          />
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function DailyChildAuthorizationForm({
  childId,
  data,
  onClose,
  onSave,
}: {
  childId: string;
  data: WorkspaceData;
  onClose: () => void;
  onSave: (authorization: DailyChildAuthorization) => void;
}) {
  const child = data.people.find((person) => person.id === childId);
  const guardianLink =
    data.guardians.find(
      (item) => item.child_id === childId && item.primary_contact,
    ) ?? data.guardians.find((item) => item.child_id === childId);
  const guardian = data.people.find(
    (person) => person.id === guardianLink?.guardian_person_id,
  );
  const today = localDateIso();
  const existing = data.dailyChildAuthorizations.find(
    (item) => item.child_id === childId && item.authorization_date === today,
  );
  const [form, setForm] = useState({
    decision: existing?.decision ?? ("authorized" as "authorized" | "denied"),
    photo: existing?.allow_photo ?? false,
    video: existing?.allow_video ?? false,
    social: existing?.allow_social_media ?? false,
    signedName: existing?.signed_name ?? guardian?.full_name ?? "",
  });
  const [error, setError] = useState("");
  return (
    <ModalShell
      title="Confirmar termo físico"
      subtitle={`AUTORIZAÇÃO DO CULTO DE ${new Date(`${today}T12:00:00`).toLocaleDateString("pt-BR")}`}
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.signedName.trim().length < 3)
            return setError("Informe o nome completo de quem assinou o termo.");
          if (
            form.decision === "authorized" &&
            !form.photo &&
            !form.video &&
            !form.social
          )
            return setError("Marque pelo menos uma autorização do termo.");
          onSave({
            id: existing?.id ?? newId(),
            church_id: child?.church_id ?? "",
            child_id: childId,
            authorization_date: today,
            decision: form.decision,
            allow_photo: form.decision === "authorized" && form.photo,
            allow_video: form.decision === "authorized" && form.video,
            allow_social_media: form.decision === "authorized" && form.social,
            signed_name: form.signedName.trim(),
            confirmed_at: new Date().toISOString(),
          });
        }}
      >
        <div className="form-scroll">
          <div className="authorization-summary">
            <span className="profile-avatar small-profile">
              {initials(child?.full_name ?? "C")}
            </span>
            <span>
              <strong>{child?.full_name}</strong>
              <small>Registre exatamente o que foi marcado no papel.</small>
            </span>
          </div>
          <div className="decision-switch">
            <button
              type="button"
              className={form.decision === "authorized" ? "allow active" : ""}
              onClick={() => setForm({ ...form, decision: "authorized" })}
            >
              <Check /> Autorizado
            </button>
            <button
              type="button"
              className={form.decision === "denied" ? "deny active" : ""}
              onClick={() =>
                setForm({
                  ...form,
                  decision: "denied",
                  photo: false,
                  video: false,
                  social: false,
                })
              }
            >
              <X /> Não autorizado
            </button>
          </div>
          {form.decision === "authorized" && (
            <div className="scope-choice">
              <CheckCard
                label="Fotografia"
                checked={form.photo}
                onChange={() => setForm({ ...form, photo: !form.photo })}
              />
              <CheckCard
                label="Gravação em vídeo"
                checked={form.video}
                onChange={() => setForm({ ...form, video: !form.video })}
              />
              <CheckCard
                label="Publicação nas redes sociais"
                checked={form.social}
                onChange={() => setForm({ ...form, social: !form.social })}
              />
            </div>
          )}
          <Field
            label="Nome completo de quem assinou"
            required
            wide
            value={form.signedName}
            onChange={(value) => setForm({ ...form, signedName: value })}
          />
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function Departments({
  data,
  currentUserId,
  isGeneralManager,
  onAdd,
  onEdit,
  onDelete,
}: {
  data: WorkspaceData;
  currentUserId: string;
  isGeneralManager: boolean;
  onAdd: () => void;
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
}) {
  const currentPerson = data.people.find(
    (person) => person.auth_user_id === currentUserId,
  );
  return (
    <>
      <PageHead
        eyebrow="EQUIPES E MINISTÉRIOS"
        title="Departamentos"
        text="Organize louvor, mídia, diaconia, pastoral e outros ministérios com funções próprias."
        action={isGeneralManager ? "Novo departamento" : undefined}
        onAction={isGeneralManager ? onAdd : undefined}
      />
      <div className="department-grid">
        {data.departments.map((department, index) => {
          const roles = data.departmentRoles.filter(
              (role) => role.department_id === department.id,
            ),
            members = data.departmentMembers.filter(
              (member) =>
                member.department_id === department.id && member.active,
            ),
            canManage =
              isGeneralManager ||
              members.some(
                (member) =>
                  member.person_id === currentPerson?.id && member.can_manage,
              );
          return (
            <article className="card department-card" key={department.id}>
              <div className={`department-art tone-${index % 3}`}>
                <Building2 />
                <span>{department.department_type}</span>
              </div>
              <div>
                <span className="status">Ativo</span>
                <h2>{department.name}</h2>
                <p>{department.description || "Sem descrição."}</p>
                <div className="department-stats">
                  <span>
                    <strong>{members.length}</strong>
                    <small>participantes</small>
                  </span>
                  <span>
                    <strong>{roles.length}</strong>
                    <small>funções</small>
                  </span>
                </div>
                <div className="role-chips">
                  {roles.slice(0, 5).map((role) => (
                    <span key={role.id}>{role.title}</span>
                  ))}
                </div>
                <div className="department-member-preview">
                  {members.slice(0, 4).map((member) => {
                    const person = data.people.find(
                        (item) => item.id === member.person_id,
                      ),
                      role = roles.find((item) => item.id === member.role_id);
                    return (
                      <span key={member.person_id}>
                        <b>{person?.full_name ?? "Pessoa"}</b>
                        <small>
                          {role?.title ?? "Sem cargo"}
                          {member.can_manage ? " • Líder gestor" : ""}
                        </small>
                      </span>
                    );
                  })}
                </div>
                <div className="department-actions">
                  {canManage ? (
                    <button
                      className="secondary wide"
                      onClick={() => onEdit(department)}
                    >
                      Gerenciar equipe e cargos <ChevronRight />
                    </button>
                  ) : (
                    <span className="managed-readonly">
                      <ShieldCheck /> Somente a liderança gerencia
                    </span>
                  )}
                  {isGeneralManager && (
                    <button
                      className="danger icon-only"
                      title={`Excluir ${department.name}`}
                      aria-label={`Excluir ${department.name}`}
                      onClick={() => onDelete(department)}
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}

function DeleteDepartmentDialog({
  department,
  onClose,
  onConfirm,
}: {
  department: Department;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      title="Excluir departamento"
      subtitle="AÇÃO PERMANENTE"
      onClose={onClose}
    >
      <div className="delete-confirmation">
        <span>
          <Trash2 />
        </span>
        <h3>Excluir “{department.name}”?</h3>
        <p>
          Os cargos e vínculos de participantes deste departamento também serão
          removidos. As pessoas continuarão cadastradas na igreja.
        </p>
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="danger" onClick={onConfirm}>
          <Trash2 /> Excluir departamento
        </button>
      </div>
    </ModalShell>
  );
}

function DeletePersonDialog({
  person,
  onClose,
  onConfirm,
}: {
  person: Person;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      title="Excluir pessoa"
      subtitle="AÇÃO PERMANENTE • GESTOR GERAL"
      onClose={onClose}
    >
      <div className="delete-confirmation">
        <span>
          <Trash2 />
        </span>
        <h3>Excluir “{person.full_name}”?</h3>
        <p>
          A ficha e seus vínculos com Kids, responsáveis, departamentos e grupos
          serão removidos. Um eventual login da equipe não será apagado.
        </p>
      </div>
      <div className="modal-actions">
        <button className="secondary" onClick={onClose}>
          Cancelar
        </button>
        <button className="danger" onClick={onConfirm}>
          <Trash2 /> Excluir pessoa definitivamente
        </button>
      </div>
    </ModalShell>
  );
}

function DepartmentForm({
  churchId,
  data,
  initial,
  onClose,
  onSave,
}: {
  churchId: string;
  data: WorkspaceData;
  initial?: Department;
  onClose: () => void;
  onSave: (
    department: Department,
    roles: string[],
    assignments: DepartmentAssignment[],
  ) => void;
}) {
  const currentRoles = initial
    ? data.departmentRoles
        .filter((role) => role.department_id === initial.id)
        .map((role) => role.title)
    : ["Líder", "Coordenador(a)", "Participante"];
  const initialAssignments = Object.fromEntries(
    (initial
      ? data.departmentMembers.filter(
          (member) => member.department_id === initial.id && member.active,
        )
      : []
    ).map((member) => [
      member.person_id,
      {
        role_title:
          data.departmentRoles.find((role) => role.id === member.role_id)
            ?.title ?? currentRoles[0],
        can_manage: Boolean(member.can_manage),
      },
    ]),
  ) as Record<string, { role_title: string; can_manage: boolean }>;
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    type: initial?.department_type ?? "worship",
    description: initial?.description ?? "",
    roles: currentRoles.join("\n"),
    assignments: initialAssignments,
  });
  const [peopleQuery, setPeopleQuery] = useState("");
  const [selectingTemplate, setSelectingTemplate] = useState(!initial);
  const [newRole, setNewRole] = useState("");
  const departmentTemplates = [
    {
      label: "Louvor",
      type: "worship",
      icon: Music,
      description: "Adoração, música e escalas.",
      roles: [
        "Líder",
        "Coordenador(a)",
        "Vocalista",
        "Músico(a)",
        "Técnico(a) de som",
        "Regente / maestro(a)",
        "Tecladista",
        "Baterista",
        "Guitarrista",
        "Violonista",
        "Baixista",
        "Backing vocal",
        "Percussionista",
      ],
    },
    {
      label: "Mídia",
      type: "media",
      icon: Monitor,
      description: "Comunicação, transmissão e redes sociais.",
      roles: [
        "Líder",
        "Diretor(a) de mídia e comunicação",
        "Coordenador(a) de equipe",
        "Operador(a) de luz",
        "Operador(a) de projeção",
        "Assistente de palco",
        "Fotógrafo(a)",
        "Cinegrafista",
        "Editor(a) de vídeo",
        "Designer gráfico",
        "Social media / gestor(a) de redes",
        "Operador(a) de transmissão",
        "Roteirista / produtor(a) de conteúdo",
      ],
    },
    {
      label: "Diaconia",
      type: "service",
      icon: Heart,
      description: "Serviço, organização e apoio à comunidade.",
      roles: [
        "Líder",
        "Diretor(a)",
        "Vice-diretor(a)",
        "Coordenador(a) de projetos sociais",
        "Assistente social",
        "Responsável por doações e arrecadações",
        "Coordenador(a) de visitas e apoio comunitário",
        "Auxiliar de logística / distribuição",
        "Voluntário(a) de apoio",
      ],
    },
    {
      label: "Ensino",
      type: "teaching",
      icon: BookOpen,
      description: "Formação bíblica, discipulado e acompanhamento.",
      roles: [
        "Líder",
        "Diretor(a)",
        "Vice-diretor(a)",
        "Supervisor(a)",
        "Coordenador(a)",
        "Professor(a)",
        "Auxiliar",
        "Secretário(a)",
        "Orientador(a)",
        "Monitor(a)",
      ],
    },
    {
      label: "Pastoral",
      type: "pastoral",
      icon: Flame,
      description: "Cuidado pastoral, aconselhamento e oração.",
      roles: [
        "Líder",
        "Pastor(a) presidente",
        "Pastor(a) auxiliar",
        "Presbítero(a)",
        "Diácono / diaconisa",
        "Líder de ministério",
        "Coordenador(a) de células / pequenos grupos",
        "Conselheiro(a) espiritual",
        "Mentor(a) ministerial",
        "Assistente pastoral",
      ],
    },
    {
      label: "Acolhimento",
      type: "welcome",
      icon: Hand,
      description: "Recepção, integração e cuidado com visitantes.",
      roles: [
        "Líder",
        "Diretor(a)",
        "Vice-diretor(a)",
        "Coordenador(a) de equipe",
        "Recepcionista",
        "Acolhedor(a)",
        "Responsável por novos convertidos",
        "Auxiliar de recepção",
      ],
    },
    {
      label: "Tesouraria",
      type: "finance",
      icon: CircleDollarSign,
      description: "Administração financeira e prestação de contas.",
      roles: [
        "Líder",
        "Tesoureiro(a)",
        "Vice-tesoureiro(a)",
        "Secretário(a)",
        "Vice-secretário(a)",
        "Auxiliar administrativo",
        "Responsável por patrimônio e inventário",
        "Responsável por documentação e arquivo",
        "Assistente financeiro(a)",
      ],
    },
    {
      label: "Missões",
      type: "missions",
      icon: Globe,
      description: "Ações missionárias e evangelismo.",
      roles: [
        "Líder",
        "Diretor(a) de missões e evangelismo",
        "Vice-diretor(a)",
        "Coordenador(a) de campo",
        "Evangelista",
        "Missionário(a)",
        "Intercessor(a) de apoio missionário",
      ],
    },
    {
      label: "Novo",
      type: "custom",
      icon: Plus,
      description: "",
      roles: ["Líder", "Coordenador(a)", "Participante"],
      custom: true,
    },
  ];
  const roleLines = form.roles.split("\n");
  const roleOptions = roleLines
    .map((role) => role.trim())
    .filter(Boolean);
  const newRoleAlreadyExists = roleOptions.some(
    (role) => role.toLocaleLowerCase("pt-BR") === newRole.trim().toLocaleLowerCase("pt-BR"),
  );
  function updateDepartmentRole(index: number, value: string) {
    const previousRole = roleLines[index]?.trim();
    const roles = roleLines.map((role, roleIndex) =>
      roleIndex === index ? value : role,
    );
    setForm({
      ...form,
      roles: roles.join("\n"),
      assignments: Object.fromEntries(
        Object.entries(form.assignments).map(([personId, assignment]) => [
          personId,
          assignment.role_title === previousRole
            ? { ...assignment, role_title: value.trim() }
            : assignment,
        ]),
      ),
    });
  }
  function removeDepartmentRole(index: number) {
    const removedRole = roleLines[index]?.trim();
    const roles = roleLines.filter((_, roleIndex) => roleIndex !== index);
    const fallbackRole =
      roles.map((role) => role.trim()).find(Boolean) ?? "Líder";
    setForm({
      ...form,
      roles: roles.join("\n"),
      assignments: Object.fromEntries(
        Object.entries(form.assignments).map(([personId, assignment]) => [
          personId,
          assignment.role_title === removedRole
            ? { ...assignment, role_title: fallbackRole }
            : assignment,
        ]),
      ),
    });
  }
  function addDepartmentRole() {
    const role = newRole.trim();
    if (!role || newRoleAlreadyExists) return;
    setForm({
      ...form,
      roles: [...roleOptions, role].join("\n"),
    });
    setNewRole("");
  }
  const normalizedPeopleQuery = peopleQuery
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
  const peopleResults = normalizedPeopleQuery
    ? data.people
        .filter((person) => {
          const normalizedName = person.full_name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLocaleLowerCase("pt-BR");
          return (
            normalizedName.includes(normalizedPeopleQuery) &&
            !form.assignments[person.id]
          );
        })
        .slice(0, 8)
    : [];
  if (selectingTemplate) {
    return (
      <ModalShell
        title="Criar novo departamento"
        subtitle="DEPARTAMENTOS"
        onClose={onClose}
      >
        <div className="department-template-picker">
          <p>Use um dos modelos prontos ou crie um novo.</p>
          <div className="department-template-grid">
            {departmentTemplates.map(
              ({ label, type, icon: Icon, description, roles, custom }) => (
                <button
                  type="button"
                  className={`department-template-card${custom ? " custom" : ""}`}
                  key={type}
                  aria-label={
                    custom
                      ? "Criar departamento personalizado"
                      : `Usar modelo ${label}`
                  }
                  onClick={() => {
                    setForm({
                      ...form,
                      name: custom ? "" : label,
                      type,
                      description,
                      roles: roles.join("\n"),
                    });
                    setSelectingTemplate(false);
                  }}
                >
                  <Icon />
                  <strong>{label}</strong>
                </button>
              ),
            )}
          </div>
        </div>
      </ModalShell>
    );
  }
  return (
    <ModalShell
      title={initial ? "Gerenciar departamento" : "Novo departamento"}
      subtitle="MINISTÉRIOS"
      onClose={onClose}
      large
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave(
            {
              id: initial?.id ?? newId(),
              church_id: churchId,
              name: form.name,
              department_type: form.type,
              description: form.description,
              active: initial?.active ?? true,
            },
            form.roles
              .split("\n")
              .map((role) => role.trim())
              .filter(Boolean),
            Object.entries(form.assignments).map(([person_id, assignment]) => ({
              person_id,
              ...assignment,
            })),
          );
        }}
      >
        <div className="form-grid modal-form department-form-scroll">
          <Field
            label="Nome do departamento"
            wide
            required
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <SelectField
            label="Modelo"
            value={form.type}
            raw
            options={[
              "worship|Louvor",
              "media|Mídia",
              "service|Diaconia",
              "teaching|Ensino",
              "pastoral|Pastoral",
              "welcome|Acolhimento",
              "finance|Tesouraria",
              "missions|Missões",
              "custom|Personalizado",
            ]}
            onChange={(value) => setForm({ ...form, type: value })}
          />
          <label className="full">
            Sobre o departamento
            <textarea
              rows={3}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </label>
          <div className="full department-people-picker">
            <strong>Participantes</strong>
            <div className="department-person-search">
              <Search />
              <input
                type="search"
                aria-label="Buscar participante pelo nome"
                placeholder="Buscar pessoa pelo nome..."
                value={peopleQuery}
                onChange={(event) => setPeopleQuery(event.target.value)}
              />
            </div>
            {normalizedPeopleQuery && (
              <div className="check-grid department-search-results">
                {peopleResults.map((person) => (
                  <CheckCard
                    key={person.id}
                    label={person.full_name}
                    checked={false}
                    onChange={() => {
                      setForm({
                        ...form,
                        assignments: {
                          ...form.assignments,
                          [person.id]: {
                            role_title: roleOptions[0] ?? "Participante",
                            can_manage: false,
                          },
                        },
                      });
                      setPeopleQuery("");
                    }}
                  />
                ))}
              </div>
            )}
            {normalizedPeopleQuery && peopleResults.length === 0 && (
              <small className="department-search-empty">
                Nenhuma pessoa disponível com esse nome.
              </small>
            )}
            <div className="department-assignments">
              {Object.keys(form.assignments).length > 0 && (
                <small className="department-selected-count">
                  {Object.keys(form.assignments).length} participante(s)
                  selecionado(s)
                </small>
              )}
              {Object.entries(form.assignments).map(
                ([personId, assignment]) => {
                  const person = data.people.find(
                    (item) => item.id === personId,
                  );
                  return (
                    <div key={personId}>
                      <span className="person-cell">
                        <span className="avatar blue">
                          {initials(person?.full_name ?? "P")}
                        </span>
                        <span>
                          <strong>{person?.full_name}</strong>
                          <small>
                            {person?.auth_user_id
                              ? "Login vinculado"
                              : "Sem login — convide em Equipe e acessos"}
                          </small>
                        </span>
                      </span>
                      <select
                        aria-label={`Cargo de ${person?.full_name}`}
                        value={assignment.role_title}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            assignments: {
                              ...form.assignments,
                              [personId]: {
                                ...assignment,
                                role_title: event.target.value,
                              },
                            },
                          })
                        }
                      >
                        {roleOptions.map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                      <label className="manager-check">
                        <input
                          type="checkbox"
                          checked={assignment.can_manage}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              assignments: {
                                ...form.assignments,
                                [personId]: {
                                  ...assignment,
                                  can_manage: event.target.checked,
                                },
                              },
                            })
                          }
                        />
                        Pode gerenciar
                      </label>
                      <button
                        type="button"
                        className="icon-only department-remove-person"
                        aria-label={`Remover ${person?.full_name ?? "participante"}`}
                        title="Remover participante"
                        onClick={() => {
                          const assignments = { ...form.assignments };
                          delete assignments[personId];
                          setForm({ ...form, assignments });
                        }}
                      >
                        <X />
                      </button>
                    </div>
                  );
                },
              )}
            </div>
          </div>
          <section className="full department-role-editor">
            <div className="department-role-heading">
              <span>
                <strong>Cargos e funções</strong>
                <small>Edite a lista ou adicione outros cargos.</small>
              </span>
              <b>{roleOptions.length}</b>
            </div>
            <div className="department-role-list">
              {roleLines.map((role, index) =>
                index === 0 ? (
                  <div className="department-role-row locked" key="leader">
                    <span>{role || "Líder"}</span>
                    <ShieldCheck />
                  </div>
                ) : (
                  <div className="department-role-row" key={index}>
                    <input
                      aria-label={`Cargo ou função ${index + 1}`}
                      value={role}
                      onChange={(event) =>
                        updateDepartmentRole(index, event.target.value)
                      }
                    />
                    <button
                      type="button"
                      className="icon-only department-role-remove"
                      aria-label={`Excluir cargo ${role || index + 1}`}
                      onClick={() => removeDepartmentRole(index)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ),
              )}
            </div>
            <div className="department-role-add">
              <input
                aria-label="Novo cargo ou função"
                placeholder="Digite um novo cargo ou função"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addDepartmentRole();
                  }
                }}
              />
              <button
                type="button"
                className="secondary"
                disabled={!newRole.trim() || newRoleAlreadyExists}
                onClick={addDepartmentRole}
              >
                <Plus /> Adicionar
              </button>
            </div>
            {newRoleAlreadyExists && (
              <small className="department-role-warning">
                Esse cargo já está na lista.
              </small>
            )}
          </section>
        </div>
        <div className="modal-actions">
          {!initial && (
            <button
              type="button"
              className="secondary"
              onClick={() => setSelectingTemplate(true)}
            >
              <ArrowLeft /> Modelos
            </button>
          )}
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary">
            <Check /> Salvar
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function PublicAuthorizationPage({ token }: { token: string }) {
  const [authorization, setAuthorization] =
      useState<PublicChildAuthorization | null>(null),
    [loading, setLoading] = useState(true),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [form, setForm] = useState({
      decision: "authorized" as "authorized" | "denied",
      photo: false,
      video: false,
      social: false,
      signedName: "",
    });
  useEffect(() => {
    loadPublicChildAuthorization(token)
      .then((data) => {
        setAuthorization(data);
        if (data) {
          setForm({
            decision: data.decision === "denied" ? "denied" : "authorized",
            photo: data.allow_photo,
            video: data.allow_video,
            social: data.allow_social_media,
            signedName: data.signed_name ?? "",
          });
        }
        if (!data) setError("Autorização não encontrada ou link inválido.");
      })
      .catch((reason) =>
        setError(
          friendlyErrorMessage(reason, "Não foi possível abrir a autorização."),
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (form.signedName.trim().length < 3) {
      setError("Informe o nome completo do responsável legal.");
      return;
    }
    if (
      form.decision === "authorized" &&
      !form.photo &&
      !form.video &&
      !form.social
    ) {
      setError("Selecione ao menos uma finalidade que deseja autorizar.");
      return;
    }
    setLoading(true);
    try {
      await respondPublicChildAuthorization(token, form);
      setAuthorization((current) =>
        current
          ? {
              ...current,
              decision: form.decision,
              allow_photo: form.decision === "authorized" && form.photo,
              allow_video: form.decision === "authorized" && form.video,
              allow_social_media: form.decision === "authorized" && form.social,
              signed_name: form.signedName.trim(),
              signed_at: new Date().toISOString(),
            }
          : current,
      );
      setDone(true);
    } catch (reason) {
      setError(friendlyErrorMessage(reason, "Não foi possível registrar."));
    } finally {
      setLoading(false);
    }
  }
  if (loading && !authorization) return <FullLoader />;
  return (
    <main className="public-consent-page">
      <section className="public-consent-card">
        <Brand />
        <div className="public-consent-icon">
          <ShieldCheck />
        </div>
        {error ? (
          <>
            <h1>Não foi possível abrir</h1>
            <p>{error}</p>
          </>
        ) : done ? (
          <>
            <h1>Decisão registrada</h1>
            <p>
              Obrigado. A equipe Kids já recebeu a sua manifestação para este
              culto.
            </p>
            {authorization && (
              <div className="public-consent-receipt">
                <span className="eyebrow">COMPROVANTE DE CONSENTIMENTO</span>
                <h2>{authorization.child_name}</h2>
                <p>
                  <strong>{authorization.event_title}</strong>
                  <br />
                  {dateTime(authorization.event_starts_at)} •{" "}
                  {authorization.church_name}
                </p>
                <div className="decision-receipt">
                  {authorizationDecision(authorization.decision)}
                </div>
                <ul>
                  <li>
                    Fotografia: {authorization.allow_photo ? "Sim" : "Não"}
                  </li>
                  <li>Vídeo: {authorization.allow_video ? "Sim" : "Não"}</li>
                  <li>
                    Redes sociais:{" "}
                    {authorization.allow_social_media ? "Sim" : "Não"}
                  </li>
                </ul>
                <p>
                  Responsável: <strong>{authorization.signed_name}</strong>
                  <br />
                  Registro: {dateTime(authorization.signed_at ?? "")}
                </p>
                <small>Documento: {authorization.authorization_id}</small>
              </div>
            )}
            <button className="primary wide" onClick={() => window.print()}>
              <Printer /> Imprimir comprovante
            </button>
            <button className="secondary" onClick={() => window.close()}>
              Fechar
            </button>
          </>
        ) : (
          authorization && (
            <form onSubmit={submit}>
              <span className="eyebrow">AUTORIZAÇÃO ESPECÍFICA POR CULTO</span>
              <h1>Uso de imagem de {authorization.child_name}</h1>
              <p className="public-event">
                <strong>{authorization.event_title}</strong>
                <br />
                {dateTime(authorization.event_starts_at)} •{" "}
                {authorization.church_name}
              </p>
              <div className="consent-copy">{authorization.consent_text}</div>
              <div className="decision-switch">
                <button
                  type="button"
                  className={
                    form.decision === "authorized" ? "allow active" : ""
                  }
                  onClick={() => setForm({ ...form, decision: "authorized" })}
                >
                  <Check />
                  Autorizar
                </button>
                <button
                  type="button"
                  className={form.decision === "denied" ? "deny active" : ""}
                  onClick={() =>
                    setForm({
                      ...form,
                      decision: "denied",
                      photo: false,
                      video: false,
                      social: false,
                    })
                  }
                >
                  <X />
                  Não autorizar
                </button>
              </div>
              {form.decision === "authorized" && (
                <div className="public-scopes">
                  <CheckCard
                    label="Fotografias"
                    checked={form.photo}
                    onChange={() => setForm({ ...form, photo: !form.photo })}
                  />
                  <CheckCard
                    label="Vídeos"
                    checked={form.video}
                    onChange={() => setForm({ ...form, video: !form.video })}
                  />
                  <CheckCard
                    label="Redes sociais"
                    checked={form.social}
                    onChange={() => setForm({ ...form, social: !form.social })}
                  />
                </div>
              )}
              <Field
                label="Nome completo do pai, mãe ou responsável legal"
                wide
                required
                value={form.signedName}
                onChange={(value) => setForm({ ...form, signedName: value })}
              />
              <p className="public-legal-note">
                Ao enviar, você confirma ser responsável legal pela criança e
                que leu a finalidade acima. A recusa não impede a participação.
              </p>
              <button className="primary wide" disabled={loading}>
                {loading ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <>
                    <FileSignature />
                    Registrar decisão
                  </>
                )}
              </button>
            </form>
          )
        )}
      </section>
    </main>
  );
}

function PublicChurchRegistrationPage({ token }: { token: string }) {
  const [registration, setRegistration] =
      useState<PublicChurchRegistration | null>(null),
    [loading, setLoading] = useState(true),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [website, setWebsite] = useState(""),
    [hasChildren, setHasChildren] = useState<boolean | undefined>(undefined),
    [form, setForm] = useState<SelfRegistrationInput>({
      full_name: "",
      birth_date: "",
      gender: "",
      education: "",
      marital_status: "",
      spouse_name: "",
      document_cpf: "",
      email: "",
      phone_primary: "",
      phone_secondary: "",
      address: { country: "Brasil" },
      conversion_date: "",
      baptism_date: "",
      categories: [],
      children: [],
      messaging_consent: false,
      data_processing_consent: false,
    });

  useEffect(() => {
    loadPublicChurchRegistration(token)
      .then((data) => {
        setRegistration(data);
        if (!data) setError("Este link de cadastro é inválido ou expirou.");
      })
      .catch((reason) =>
        setError(
          friendlyErrorMessage(reason, "Não foi possível abrir o cadastro."),
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);

  function setAddress(field: keyof Person["address"], value: string) {
    setForm((current) => ({
      ...current,
      address: { ...current.address, [field]: value },
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (website) return;
    const birthDate = brazilianDateToIso(form.birth_date);
    if (!birthDate) {
      setError("Informe uma data de nascimento válida em dd/mm/aaaa.");
      return;
    }
    if (!form.categories.length) {
      setError("Assinale Membro, Visitante, Adolescente ou Criança.");
      return;
    }
    if (hasChildren === undefined) {
      setError("Informe se você possui filhos.");
      return;
    }
    const normalizedParentCpf = form.document_cpf?.replace(/\D/g, "") ?? "";
    if (normalizedParentCpf.length !== 11) {
      setError("Informe um CPF válido para o responsável.");
      return;
    }
    const childrenError = hasChildren
      ? familyChildrenError(form.children, "criança")
      : "";
    if (childrenError) {
      setError(childrenError);
      return;
    }
    const preparedChildren = form.children.map((child) => ({
      full_name: child.full_name.trim(),
      birth_date: brazilianDateToIso(child.birth_date) ?? "",
      document_cpf: child.document_cpf.replace(/\D/g, ""),
      gender: child.gender,
      valid_birth_date: personAge(child.birth_date) !== null,
    }));
    const familyCpfs = [
      normalizedParentCpf,
      ...preparedChildren.map((child) => child.document_cpf),
    ];
    if (new Set(familyCpfs).size !== familyCpfs.length) {
      setError("Cada pessoa da família precisa ter um CPF diferente.");
      return;
    }
    setLoading(true);
    try {
      await submitPublicChurchRegistration(token, {
        ...form,
        birth_date: birthDate,
        children: preparedChildren.map((child) => ({
          full_name: child.full_name,
          birth_date: child.birth_date,
          document_cpf: child.document_cpf,
          gender: child.gender,
        })),
      });
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        friendlyErrorMessage(reason, "Não foi possível enviar o cadastro."),
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading && !registration) return <FullLoader />;
  return (
    <main className="public-consent-page public-registration-page">
      <section className="public-consent-card public-registration-card">
        <Brand />
        {error && !registration ? (
          <div className="public-result">
            <div className="public-consent-icon error">
              <X />
            </div>
            <h1>Não foi possível abrir</h1>
            <p>{error}</p>
          </div>
        ) : done ? (
          <div className="public-result">
            <div className="public-consent-icon">
              <Check />
            </div>
            <span className="eyebrow">CADASTRO RECEBIDO</span>
            <h1>Seja bem-vindo(a)!</h1>
            <p>
              Suas informações foram enviadas para{" "}
              <strong>{registration?.church_name}</strong>. A equipe da igreja
              poderá revisar e complementar sua ficha.
            </p>
          </div>
        ) : (
          registration && (
            <form onSubmit={submit}>
              <div className="public-registration-heading">
                <span className="public-consent-icon">
                  <UserRound />
                </span>
                <span>
                  <span className="eyebrow">CADASTRO DE MEMBRO</span>
                  <h1>Vamos conhecer você</h1>
                  <p>
                    Preencha seus dados para se vincular à{" "}
                    {registration.church_name}.
                  </p>
                </span>
              </div>

              {error && <div className="form-alert error">{error}</div>}
              <input
                className="registration-honeypot"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />

              <FormSection title="Dados pessoais">
                <div className="form-grid public-form-grid">
                  <Field
                    label="Nome completo"
                    required
                    value={form.full_name}
                    onChange={(full_name) => setForm({ ...form, full_name })}
                  />
                  <Field
                    label="CPF"
                    required
                    value={form.document_cpf}
                    onChange={(document_cpf) =>
                      setForm({ ...form, document_cpf: maskCpf(document_cpf) })
                    }
                  />
                  <Field
                    label="Data de nascimento"
                    required
                    placeholder="dd/mm/aaaa"
                    inputMode="numeric"
                    value={form.birth_date}
                    onChange={(birth_date) =>
                      setForm({
                        ...form,
                        birth_date: maskBrazilianDate(birth_date),
                      })
                    }
                  />
                  <SelectField
                    label="Sexo"
                    required
                    value={form.gender}
                    options={["Homem", "Mulher", "Prefiro não informar"]}
                    onChange={(gender) => setForm({ ...form, gender })}
                  />
                  <SelectField
                    label="Escolaridade"
                    required
                    value={form.education}
                    options={[
                      "Ensino Fundamental",
                      "Ensino Médio",
                      "Ensino Superior",
                      "Pós-graduação",
                    ]}
                    onChange={(education) => setForm({ ...form, education })}
                  />
                  <SelectField
                    label="Estado civil"
                    required
                    value={form.marital_status}
                    options={[
                      "Solteiro(a)",
                      "Casado(a)",
                      "Divorciado(a)",
                      "Viúvo(a)",
                      "União estável",
                    ]}
                    onChange={(marital_status) =>
                      setForm({
                        ...form,
                        marital_status,
                        spouse_name:
                          marital_status === "Casado(a)" ||
                          marital_status === "União estável"
                            ? form.spouse_name
                            : "",
                      })
                    }
                  />
                  {(form.marital_status === "Casado(a)" ||
                    form.marital_status === "União estável") && (
                    <Field
                      label="Nome completo do cônjuge"
                      required
                      value={form.spouse_name}
                      onChange={(spouse_name) =>
                        setForm({ ...form, spouse_name })
                      }
                    />
                  )}
                </div>
              </FormSection>

              <FormSection title="Vínculo com a igreja" required>
                <p className="field-help">Assinale pelo menos uma opção.</p>
                <div className="check-grid public-category-grid">
                  {["Membro", "Visitante", "Adolescente", "Criança"].map(
                    (category) => (
                      <CheckCard
                        key={category}
                        label={category}
                        checked={form.categories.includes(category)}
                        onChange={() =>
                          setForm({
                            ...form,
                            categories: form.categories.includes(category)
                              ? form.categories.filter(
                                  (item) => item !== category,
                                )
                              : [...form.categories, category],
                          })
                        }
                      />
                    ),
                  )}
                </div>
              </FormSection>

              <FormSection title="Filhos">
                <div className="form-grid public-form-grid">
                  <SelectField
                    label="Possui filhos?"
                    required
                    value={
                      hasChildren === undefined
                        ? ""
                        : hasChildren
                          ? "Sim"
                          : "Não"
                    }
                    options={["Sim", "Não"]}
                    onChange={(value) => {
                      const next = value === "Sim";
                      setHasChildren(value ? next : undefined);
                      setForm({
                        ...form,
                        children: next
                          ? [
                              {
                                full_name: "",
                                birth_date: "",
                                gender: "",
                                document_cpf: "",
                              },
                            ]
                          : [],
                      });
                    }}
                  />
                </div>
                {hasChildren && (
                  <div className="children-name-list">
                    {form.children.map((child, index) => (
                      <div className="family-child-card" key={index}>
                        <div className="family-child-heading">
                          <strong>Criança {index + 1}</strong>
                          {form.children.length > 1 && (
                            <button
                              type="button"
                              className="icon-only danger"
                              aria-label={`Remover filho ${index + 1}`}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  children: form.children.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                })
                              }
                            >
                              <Trash2 />
                            </button>
                          )}
                        </div>
                        <div className="form-grid public-form-grid">
                          <Field
                            label={`CPF do filho ${index + 1}`}
                            required
                            inputMode="numeric"
                            value={child.document_cpf}
                            onChange={(document_cpf) =>
                              setForm({
                                ...form,
                                children: form.children.map(
                                  (current, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...current,
                                          document_cpf: maskCpf(document_cpf),
                                        }
                                      : current,
                                ),
                              })
                            }
                          />
                          <Field
                            label={`Nome completo do filho ${index + 1}`}
                            required
                            wide
                            value={child.full_name}
                            onChange={(full_name) =>
                              setForm({
                                ...form,
                                children: form.children.map(
                                  (current, itemIndex) =>
                                    itemIndex === index
                                      ? { ...current, full_name }
                                      : current,
                                ),
                              })
                            }
                          />
                          <Field
                            label={`Data de nascimento do filho ${index + 1}`}
                            required
                            placeholder="dd/mm/aaaa"
                            inputMode="numeric"
                            value={child.birth_date}
                            onChange={(birth_date) =>
                              setForm({
                                ...form,
                                children: form.children.map(
                                  (current, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...current,
                                          birth_date:
                                            maskBrazilianDate(birth_date),
                                        }
                                      : current,
                                ),
                              })
                            }
                          />
                          <SelectField
                            label={`Sexo do filho ${index + 1}`}
                            required
                            value={child.gender}
                            options={[
                              "Homem",
                              "Mulher",
                              "Prefiro não informar",
                            ]}
                            onChange={(gender) =>
                              setForm({
                                ...form,
                                children: form.children.map(
                                  (current, itemIndex) =>
                                    itemIndex === index
                                      ? { ...current, gender }
                                      : current,
                                ),
                              })
                            }
                          />
                        </div>
                        {personAge(child.birth_date) !== null && (
                          <small className="child-age">
                            Idade atual: {personAge(child.birth_date)} anos
                          </small>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="secondary add-child-name"
                      onClick={() =>
                        setForm({
                          ...form,
                          children: [
                            ...form.children,
                            {
                              full_name: "",
                              birth_date: "",
                              gender: "",
                              document_cpf: "",
                            },
                          ],
                        })
                      }
                    >
                      <Plus /> Adicionar outro filho
                    </button>
                  </div>
                )}
              </FormSection>

              <FormSection title="Contato">
                <div className="form-grid public-form-grid">
                  <Field
                    label="Telefone WhatsApp"
                    required
                    value={form.phone_primary}
                    onChange={(phone_primary) =>
                      setForm({
                        ...form,
                        phone_primary: maskPhone(phone_primary),
                      })
                    }
                  />
                  <Field
                    label="Telefone alternativo (opcional)"
                    value={form.phone_secondary}
                    onChange={(phone_secondary) =>
                      setForm({
                        ...form,
                        phone_secondary: maskPhone(phone_secondary),
                      })
                    }
                  />
                  <Field
                    label="E-mail"
                    type="email"
                    required
                    wide
                    value={form.email}
                    onChange={(email) => setForm({ ...form, email })}
                  />
                </div>
              </FormSection>

              <FormSection title="Endereço">
                <div className="form-grid public-form-grid">
                  <CepField
                    required
                    value={form.address.zip}
                    onChange={(value) => setAddress("zip", value)}
                    onAddress={(found) =>
                      setForm((current) => ({
                        ...current,
                        address: { ...current.address, ...found },
                      }))
                    }
                  />
                  <Field
                    label="Rua / endereço"
                    wide
                    required
                    value={form.address.street}
                    onChange={(value) => setAddress("street", value)}
                  />
                  <Field
                    label="Número"
                    required
                    value={form.address.number}
                    onChange={(value) => setAddress("number", value)}
                  />
                  <Field
                    label="Complemento"
                    required
                    value={form.address.complement}
                    onChange={(value) => setAddress("complement", value)}
                  />
                  <Field
                    label="Bairro"
                    required
                    value={form.address.district}
                    onChange={(value) => setAddress("district", value)}
                  />
                  <Field
                    label="Cidade"
                    required
                    value={form.address.city}
                    onChange={(value) => setAddress("city", value)}
                  />
                  <Field
                    label="Estado"
                    required
                    value={form.address.state}
                    onChange={(value) => setAddress("state", value)}
                  />
                  <Field
                    label="País"
                    required
                    value={form.address.country}
                    onChange={(value) => setAddress("country", value)}
                  />
                </div>
              </FormSection>

              <FormSection title="Vida cristã">
                <div className="form-grid public-form-grid">
                  <Field
                    label="Data de conversão"
                    type="date"
                    value={form.conversion_date}
                    onChange={(conversion_date) =>
                      setForm({ ...form, conversion_date })
                    }
                  />
                  <Field
                    label="Data do batismo"
                    type="date"
                    value={form.baptism_date}
                    onChange={(baptism_date) =>
                      setForm({ ...form, baptism_date })
                    }
                  />
                </div>
              </FormSection>

              <FormSection title="Privacidade e contato">
                <div className="public-consent-options">
                  <label>
                    <input
                      type="checkbox"
                      required
                      checked={form.data_processing_consent}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          data_processing_consent: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>
                        Autorizo o tratamento dos meus dados pessoais.
                        <b className="required-mark" aria-hidden="true">
                          {" "}
                          *
                        </b>
                      </strong>
                      <small>
                        Necessário para manter minha ficha e realizar o cuidado
                        e a comunicação da igreja, conforme a LGPD.
                      </small>
                    </span>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.messaging_consent}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          messaging_consent: event.target.checked,
                        })
                      }
                    />
                    <span>
                      <strong>Aceito receber mensagens da igreja.</strong>
                      <small>
                        Este consentimento é opcional e pode ser alterado
                        depois.
                      </small>
                    </span>
                  </label>
                </div>
              </FormSection>

              <p className="public-legal-note">
                Seus dados serão vinculados somente à {registration.church_name}
                . O envio não cria acesso administrativo ao sistema.
              </p>
              <button className="primary wide" disabled={loading}>
                {loading ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <>
                    <Check />
                    <span>Enviar meu cadastro</span>
                  </>
                )}
              </button>
            </form>
          )
        )}
      </section>
    </main>
  );
}

function Teaching({
  data,
  currentUserId,
  canCreate,
  onAdd,
  onEdit,
  onMeeting,
}: {
  data: WorkspaceData;
  currentUserId: string;
  canCreate: boolean;
  onAdd: () => void;
  onEdit: (group: TeachingGroup) => void;
  onMeeting: (group: TeachingGroup) => void;
}) {
  const { groups, people } = data;
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const currentPerson = people.find(
    (person) => person.auth_user_id === currentUserId,
  );
  return (
    <>
      <PageHead
        eyebrow="FORMAÇÃO E CUIDADO"
        title="Grupos de ensino"
        text="Consolidação, membresia e formação organizadas por turmas."
        action={canCreate ? "Novo grupo" : undefined}
        onAction={canCreate ? onAdd : undefined}
      />
      <div className="teaching-summary">
        <div>
          <BookOpen />
          <span>
            <strong>
              {groups.filter((g) => g.active).length} grupos ativos
            </strong>
            <small>
              {groups.reduce((s, g) => s + (g.members ?? 0), 0)} participantes
            </small>
          </span>
        </div>
        <span>{people.length} pessoas disponíveis</span>
      </div>
      {groups.length ? (
        <div className="group-grid">
          {groups.map((g, i) => (
            <article className="group-card" key={g.id}>
              <div
                className={`group-art ${["green", "blue", "gold", "coral"][i % 4]}`}
              >
                <BookOpen />
                <span>{g.track}</span>
              </div>
              <div className="group-body">
                <span className="eyebrow">{g.track}</span>
                <h2>{g.name}</h2>
                <p className="group-description">
                  {g.description || "Sem descrição."}
                </p>
                <div className="group-meta">
                  <span>
                    <Users /> {g.members ?? 0}
                    {g.capacity ? ` de ${g.capacity}` : ""} participantes
                  </span>
                  <span>
                    <UserRound />{" "}
                    {people.find((person) => person.id === g.leader_id)
                      ?.full_name || "Liderança a definir"}
                  </span>
                  <span>
                    <CalendarDays /> {weekday(g.weekday)} •{" "}
                    {g.starts_at?.slice(0, 5) || "horário a definir"}
                  </span>
                  <span>
                    <Building2 /> {g.location || "Local a definir"}
                  </span>
                </div>
                <button
                  className="secondary wide"
                  onClick={() =>
                    setExpandedGroup(expandedGroup === g.id ? null : g.id)
                  }
                >
                  {expandedGroup === g.id ? "Ocultar" : "Ver participantes"}{" "}
                  <ChevronRight />
                </button>
                {expandedGroup === g.id && (
                  <div className="group-roster">
                    {people
                      .filter((person) => person.group_ids.includes(g.id))
                      .map((person) => (
                        <span className="person-cell" key={person.id}>
                          <span className="avatar blue">
                            {initials(person.full_name)}
                          </span>
                          <span>
                            <strong>{person.full_name}</strong>
                            <small>
                              {person.group_roles?.[g.id] ??
                                (person.id === g.leader_id
                                  ? "Líder"
                                  : "Aluno(a)")}
                            </small>
                          </span>
                        </span>
                      ))}
                    {!people.some((person) =>
                      person.group_ids.includes(g.id),
                    ) && <small>Nenhum participante vinculado.</small>}
                  </div>
                )}
                {(canCreate || g.leader_id === currentPerson?.id) && (
                  <div className="teaching-actions">
                    <button
                      className="secondary wide"
                      onClick={() => onEdit(g)}
                    >
                      <Pencil /> Gerenciar turma
                    </button>
                    <button
                      className="primary wide"
                      onClick={() => onMeeting(g)}
                    >
                      <ClipboardCheck /> Registrar aula e presença
                    </button>
                  </div>
                )}
                <div className="meeting-history">
                  {data.teachingMeetings
                    .filter((meeting) => meeting.group_id === g.id)
                    .slice(-3)
                    .reverse()
                    .map((meeting) => {
                      const attendance = data.teachingAttendance.filter(
                        (item) => item.meeting_id === meeting.id,
                      );
                      return (
                        <span key={meeting.id}>
                          <b>{meeting.title}</b>
                          <small>
                            {new Date(
                              `${meeting.meeting_date}T12:00:00`,
                            ).toLocaleDateString("pt-BR")}{" "}
                            —{" "}
                            {
                              attendance.filter(
                                (item) => item.status === "present",
                              ).length
                            }{" "}
                            presentes
                          </small>
                        </span>
                      );
                    })}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Nenhum grupo cadastrado"
          text="Crie o primeiro grupo de consolidação ou ensino."
          action="Novo grupo"
          onAction={onAdd}
        />
      )}
    </>
  );
}

function Agenda({
  events,
  onAdd,
  onEdit,
}: {
  events: ChurchEvent[];
  onAdd: (date?: string) => void;
  onEdit: (event: ChurchEvent) => void;
}) {
  const [cursor, setCursor] = useState(new Date(2026, 7, 1)),
    [view, setView] = useState<"month" | "list">("month"),
    year = cursor.getFullYear(),
    month = cursor.getMonth(),
    offset = new Date(year, month, 1).getDay(),
    count = new Date(year, month + 1, 0).getDate(),
    days = Array.from(
      { length: Math.ceil((offset + count) / 7) * 7 },
      (_, i) => (i >= offset && i < offset + count ? i - offset + 1 : null),
    ),
    monthEvents = events.filter((e) => {
      const d = new Date(e.starts_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  return (
    <>
      <PageHead
        eyebrow="ORGANIZAÇÃO"
        title="Agenda"
        text="Eventos, cultos, reuniões e aulas em um calendário compartilhado."
        action="Novo compromisso"
        onAction={() => onAdd()}
      />
      <section className="calendar card">
        <div className="calendar-head">
          <div>
            <button
              className="icon-only"
              onClick={() => setCursor(new Date(year, month - 1, 1))}
            >
              <ChevronLeft />
            </button>
            <button
              className="icon-only"
              onClick={() => setCursor(new Date(year, month + 1, 1))}
            >
              <ChevronRight />
            </button>
            <button className="secondary" onClick={() => setCursor(new Date())}>
              Hoje
            </button>
          </div>
          <h2>
            {cursor.toLocaleDateString("pt-BR", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="view-switch">
            <button
              className={view === "month" ? "active" : ""}
              onClick={() => setView("month")}
            >
              Mês
            </button>
            <button
              className={view === "list" ? "active" : ""}
              onClick={() => setView("list")}
            >
              Lista
            </button>
          </div>
        </div>
        {view === "month" ? (
          <>
            <div className="calendar-week">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="calendar-grid">
              {days.map((day, i) => (
                <div
                  className="calendar-day"
                  key={i}
                >
                  {day && (
                    <button
                      type="button"
                      className="calendar-day-add"
                      aria-label={`Novo compromisso em ${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`}
                      onClick={() =>
                        onAdd(
                          `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
                        )
                      }
                    >
                      {day}
                    </button>
                  )}
                  {day &&
                    monthEvents
                      .filter((e) => new Date(e.starts_at).getDate() === day)
                      .map((e) => (
                        <button
                          type="button"
                          className={`cal-event ${e.color}`}
                          key={e.id}
                          aria-label={`Editar ${e.title}`}
                          onClick={() => onEdit(e)}
                        >
                          {new Date(e.starts_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {e.title}
                        </button>
                      ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="event-list">
            {monthEvents.map((e) => (
              <div className="event-row" key={e.id}>
                <span className={`date-block ${e.color}`}>
                  <b>{new Date(e.starts_at).getDate()}</b>
                  <small>
                    {cursor.toLocaleDateString("pt-BR", { month: "short" })}
                  </small>
                </span>
                <span>
                  <strong>{e.title}</strong>
                  <small>
                    {dateTime(e.starts_at)} • {e.location || "Local a definir"}
                  </small>
                </span>
                <button
                  type="button"
                  className="secondary event-edit-button"
                  aria-label={`Editar ${e.title}`}
                  onClick={() => onEdit(e)}
                >
                  <Pencil /> Editar
                </button>
              </div>
            ))}
            {!monthEvents.length && (
              <p className="inline-empty">Nenhum compromisso neste mês.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}

function Finance({
  entries,
  accounts,
  categories,
  onAdd,
  onAddAccount,
  onAddCategory,
}: {
  entries: FinanceEntry[];
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  onAdd: () => void;
  onAddAccount: () => void;
  onAddCategory: () => void;
}) {
  const paid = entries.filter((e) => e.status === "paid"),
    income = paid
      .filter((e) => e.type === "income")
      .reduce((s, e) => s + e.amount, 0),
    expense = paid
      .filter((e) => e.type === "expense")
      .reduce((s, e) => s + e.amount, 0),
    pending = entries
      .filter((e) => e.status === "pending")
      .reduce((s, e) => s + e.amount, 0),
    openingBalance = accounts.reduce(
      (sum, account) => sum + account.opening_balance,
      0,
    );
  return (
    <>
      <PageHead
        eyebrow="RECURSOS"
        title="Financeiro"
        text="Receitas, despesas e compromissos com transparência."
        action="Novo lançamento"
        onAction={onAdd}
      />
      <div className="finance-metrics">
        <Metric
          icon={ArrowDownLeft}
          label="Entradas"
          value={currency(income)}
          detail="recebimentos pagos"
          positive
        />
        <Metric
          icon={ArrowUpRight}
          label="Saídas"
          value={currency(expense)}
          detail="pagamentos realizados"
        />
        <Metric
          icon={Wallet}
          label="Saldo atual"
          value={currency(openingBalance + income - expense)}
          detail={`${accounts.length} contas ativas`}
          positive={openingBalance + income >= expense}
        />
        <Metric
          icon={CircleDollarSign}
          label="Pendentes"
          value={currency(pending)}
          detail="a liquidar"
        />
      </div>
      <div className="finance-detail-grid">
        <section className="card">
          <CardTitle title="Lançamentos" />
          <div className="transaction-table">
            <div className="transaction-head">
              <span>Descrição</span>
              <span>Vencimento</span>
              <span>Situação</span>
              <span>Valor</span>
            </div>
            {entries.map((entry) => (
              <div className="transaction-line" key={entry.id}>
                <span>
                  <i className={entry.type === "income" ? "in" : "out"}>
                    {entry.type === "income" ? (
                      <ArrowDownLeft />
                    ) : (
                      <ArrowUpRight />
                    )}
                  </i>
                  <span>
                    <strong>{entry.description}</strong>
                    <small>
                      {categories.find(
                        (category) => category.id === entry.category_id,
                      )?.name || "Sem categoria"}
                    </small>
                  </span>
                </span>
                <span>{formatDate(entry.due_date)}</span>
                <span>
                  <b className={`status ${entry.status}`}>
                    {entry.status === "paid"
                      ? "Pago"
                      : entry.status === "pending"
                        ? "Pendente"
                        : "Cancelado"}
                  </b>
                </span>
                <strong
                  className={entry.type === "income" ? "positive" : "negative"}
                >
                  {entry.type === "income" ? "+" : "-"} {currency(entry.amount)}
                </strong>
              </div>
            ))}
          </div>
          {!entries.length && (
            <p className="inline-empty">Nenhum lançamento cadastrado.</p>
          )}
        </section>
        <aside className="finance-side">
          <section className="card compact-list">
            <CardTitle title="Contas" action="Nova" onAction={onAddAccount} />
            {accounts.map((account) => {
              const movement = entries
                .filter(
                  (entry) =>
                    entry.account_id === account.id && entry.status === "paid",
                )
                .reduce(
                  (sum, entry) =>
                    sum +
                    (entry.type === "income" ? entry.amount : -entry.amount),
                  0,
                );
              return (
                <div className="account-row" key={account.id}>
                  <span>
                    <Wallet />
                    <strong>{account.name}</strong>
                  </span>
                  <b>{currency(account.opening_balance + movement)}</b>
                </div>
              );
            })}
            {!accounts.length && (
              <p className="inline-empty">Crie a primeira conta.</p>
            )}
          </section>
          <section className="card compact-list">
            <CardTitle
              title="Categorias"
              action="Nova"
              onAction={onAddCategory}
            />
            {categories.map((category) => (
              <div className="category-row" key={category.id}>
                <span className={category.type}>
                  {category.type === "income" ? (
                    <ArrowDownLeft />
                  ) : (
                    <ArrowUpRight />
                  )}
                </span>
                <strong>{category.name}</strong>
              </div>
            ))}
            {!categories.length && (
              <p className="inline-empty">Crie a primeira categoria.</p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
function Churches({
  churches,
  onAdd,
}: {
  churches: Church[];
  onAdd: () => void;
}) {
  return (
    <>
      <PageHead
        eyebrow="AMBIENTE MASTER"
        title="Igrejas"
        text="Crie e acompanhe as comunidades que usam a plataforma."
        action="Nova igreja"
        onAction={onAdd}
      />
      <div className="church-grid">
        {churches.map((c, i) => (
          <article className="card church-card" key={c.id}>
            <div className={`church-logo tone-${i % 3}`}>
              {initials(c.name)}
            </div>
            <span className={`status ${c.active ? "active-dot" : "inactive"}`}>
              {c.active ? "Ativa" : "Inativa"}
            </span>
            <h2>{c.name}</h2>
            <p>
              {[c.city, c.state].filter(Boolean).join(" • ") ||
                "Local não informado"}
            </p>
            <div>
              <span>
                <strong>{c.email || "—"}</strong>
                <small>e-mail</small>
              </span>
              <span>
                <strong>{c.phone || "—"}</strong>
                <small>telefone</small>
              </span>
            </div>
            <div className="platform-only-note">
              <ShieldCheck /> Administração operacional feita pelo Gestor Geral
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
function Access({
  role,
  churchId,
  churchName,
  notify,
}: {
  role: Role;
  churchId: string;
  churchName: string;
  notify: (message: string) => void;
}) {
  const [team, setTeam] = useState<TeamMember[]>([]),
    [inviting, setInviting] = useState(false),
    [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState({
    fullName: "",
    email: "",
    role: "viewer" as Role,
  });
  useEffect(() => {
    loadTeam(churchId)
      .then(setTeam)
      .catch((error) =>
        notify(
          friendlyErrorMessage(error, "Não foi possível carregar a equipe."),
        ),
      );
  }, [churchId, notify]);
  async function sendInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await inviteTeamMember(
        churchId,
        invite.email,
        invite.fullName,
        invite.role,
      );
      if (isDemoMode)
        setTeam((current) => [
          ...current,
          {
            id: newId(),
            user_id: newId(),
            full_name: invite.fullName,
            role: invite.role,
            active: true,
          },
        ]);
      else setTeam(await loadTeam(churchId));
      setInviting(false);
      setInvite({ fullName: "", email: "", role: "viewer" });
      notify(
        isDemoMode
          ? "Convite simulado no modo demonstração."
          : "Convite enviado por e-mail.",
      );
    } catch (error) {
      notify(friendlyErrorMessage(error, "Não foi possível convidar."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="SEGURANÇA"
        title="Equipe e acessos"
        text={`Usuários e cargos de ${churchName}.`}
        action="Convidar usuário"
        onAction={() => setInviting(true)}
      />
      {inviting && (
        <section className="card invite-card">
          <form onSubmit={sendInvite}>
            <Field
              label="Nome completo"
              required
              value={invite.fullName}
              onChange={(v) => setInvite({ ...invite, fullName: v })}
            />
            <Field
              label="E-mail"
              type="email"
              required
              value={invite.email}
              onChange={(v) => setInvite({ ...invite, email: v })}
            />
            <SelectField
              label="Cargo"
              value={invite.role}
              raw
              options={[
                "super|Gestor geral",
                "people|Pessoas",
                "teaching|Ensino",
                "finance|Financeiro",
                "agenda|Agenda",
                "viewer|Somente consulta",
              ]}
              onChange={(v) => setInvite({ ...invite, role: v as Role })}
            />
            <button
              type="button"
              className="secondary"
              onClick={() => setInviting(false)}
            >
              Cancelar
            </button>
            <button className="primary" disabled={busy}>
              {busy ? <LoaderCircle className="spin" /> : "Enviar convite"}
            </button>
          </form>
        </section>
      )}
      <div className="access-layout">
        <section className="card">
          <CardTitle title="Usuários da equipe" />
          {team.map((member) => (
            <div className="access-user" key={member.id}>
              <span className="avatar green">{initials(member.full_name)}</span>
              <span>
                <strong>{member.full_name}</strong>
                <small>{roleLabel(member.role)}</small>
              </span>
              <b className={`status ${member.active ? "" : "inactive"}`}>
                {member.active ? "Ativo" : "Inativo"}
              </b>
            </div>
          ))}
          {!team.length && (
            <p className="inline-empty">Nenhum usuário vinculado.</p>
          )}
        </section>
        <section className="card access-intro">
          <span className="metric-icon">
            <ShieldCheck />
          </span>
          <h2>Seu acesso</h2>
          <strong>{roleLabel(role)}</strong>
          <p>
            O Master administra igrejas. O Gestor geral convida a equipe, e cada
            cargo possui acesso limitado ao seu módulo pelas políticas do
            Supabase.
          </p>
        </section>
      </div>
    </>
  );
}

function GroupForm({
  churchId,
  people,
  initial,
  onClose,
  onSave,
}: {
  churchId: string;
  people: Person[];
  initial?: TeachingGroup;
  onClose: () => void;
  onSave: (g: TeachingGroup) => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    track: initial?.track ?? "Consolidação",
    description: initial?.description ?? "",
    leader_id: initial?.leader_id ?? "",
    weekday: String(initial?.weekday ?? 1),
    starts_at: initial?.starts_at?.slice(0, 5) ?? "19:30",
    location: initial?.location ?? "",
    capacity: String(initial?.capacity ?? 20),
    member_ids: initial
      ? people
          .filter((person) => person.group_ids.includes(initial.id))
          .map((person) => person.id)
      : ([] as string[]),
    member_roles: Object.fromEntries(
      initial
        ? people
            .filter((person) => person.group_ids.includes(initial.id))
            .map((person) => [
              person.id,
              person.group_roles?.[initial.id] ?? "Aluno(a)",
            ])
        : [],
    ) as Record<string, string>,
  });
  return (
    <ModalShell
      title={initial ? "Gerenciar grupo de ensino" : "Novo grupo de ensino"}
      subtitle="FORMAÇÃO"
      onClose={onClose}
      large
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: initial?.id ?? newId(),
            church_id: churchId,
            ...form,
            weekday: Number(form.weekday),
            capacity: Number(form.capacity),
            active: true,
            members: 0,
            member_ids: [
              ...new Set([...form.member_ids, form.leader_id].filter(Boolean)),
            ],
            member_roles: form.member_roles,
          });
        }}
      >
        <div className="form-grid modal-form department-form-scroll">
          <Field
            label="Nome do grupo"
            wide
            required
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <SelectField
            label="Jornada"
            value={form.track}
            options={[
              "Consolidação",
              "Integração",
              "Membresia",
              "Liderança",
              "Discipulado",
            ]}
            onChange={(v) => setForm({ ...form, track: v })}
          />
          <SelectField
            label="Líder"
            value={form.leader_id}
            required
            options={people.map((person) => `${person.id}|${person.full_name}`)}
            raw
            onChange={(v) => setForm({ ...form, leader_id: v })}
          />
          <SelectField
            label="Dia"
            value={form.weekday}
            options={[
              "0|Domingo",
              "1|Segunda-feira",
              "2|Terça-feira",
              "3|Quarta-feira",
              "4|Quinta-feira",
              "5|Sexta-feira",
              "6|Sábado",
            ]}
            onChange={(v) => setForm({ ...form, weekday: v })}
            raw
          />
          <Field
            label="Horário"
            type="time"
            value={form.starts_at}
            onChange={(v) => setForm({ ...form, starts_at: v })}
          />
          <Field
            label="Local"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
          />
          <Field
            label="Capacidade"
            type="number"
            value={form.capacity}
            onChange={(v) => setForm({ ...form, capacity: v })}
          />
          <label className="full">
            Descrição
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <div className="full department-people-picker">
            <strong>Participantes da turma</strong>
            <div className="check-grid">
              {people.map((person) => (
                <CheckCard
                  key={person.id}
                  label={person.full_name}
                  checked={form.member_ids.includes(person.id)}
                  onChange={() =>
                    setForm({
                      ...form,
                      member_ids: form.member_ids.includes(person.id)
                        ? form.member_ids.filter((id) => id !== person.id)
                        : [...form.member_ids, person.id],
                      member_roles: {
                        ...form.member_roles,
                        [person.id]: form.member_roles[person.id] ?? "Aluno(a)",
                      },
                    })
                  }
                />
              ))}
            </div>
            <div className="department-assignments">
              {form.member_ids.map((personId) => {
                const person = people.find((item) => item.id === personId);
                return (
                  <div key={personId}>
                    <span className="person-cell">
                      <span className="avatar blue">
                        {initials(person?.full_name ?? "P")}
                      </span>
                      <strong>{person?.full_name}</strong>
                    </span>
                    <select
                      aria-label={`Função de ${person?.full_name}`}
                      value={
                        form.leader_id === personId
                          ? "Líder"
                          : (form.member_roles[personId] ?? "Aluno(a)")
                      }
                      disabled={form.leader_id === personId}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          member_roles: {
                            ...form.member_roles,
                            [personId]: event.target.value,
                          },
                        })
                      }
                    >
                      {[
                        "Líder",
                        "Professor(a)",
                        "Auxiliar",
                        "Secretário(a)",
                        "Aluno(a)",
                      ].map((role) => (
                        <option key={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}
function TeachingMeetingForm({
  churchId,
  group,
  people,
  onClose,
  onSave,
}: {
  churchId: string;
  group: TeachingGroup;
  people: Person[];
  onClose: () => void;
  onSave: (meeting: TeachingMeeting, attendance: TeachingAttendance[]) => void;
}) {
  const members = people.filter((person) =>
    person.group_ids.includes(group.id),
  );
  const [title, setTitle] = useState(`Aula — ${group.name}`);
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [lesson, setLesson] = useState("");
  const [notes, setNotes] = useState("");
  const [statuses, setStatuses] = useState<
    Record<string, TeachingAttendance["status"]>
  >(Object.fromEntries(members.map((person) => [person.id, "present"])));
  return (
    <ModalShell
      title="Registrar aula e frequência"
      subtitle={group.name.toUpperCase()}
      onClose={onClose}
      large
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const meetingId = newId();
          onSave(
            {
              id: meetingId,
              church_id: churchId,
              group_id: group.id,
              title,
              meeting_date: meetingDate,
              lesson,
              notes,
            },
            members.map((person) => ({
              church_id: churchId,
              meeting_id: meetingId,
              person_id: person.id,
              status: statuses[person.id] ?? "absent",
            })),
          );
        }}
      >
        <div className="form-grid modal-form">
          <Field
            label="Título da aula"
            wide
            required
            value={title}
            onChange={setTitle}
          />
          <Field
            label="Data"
            type="date"
            required
            value={meetingDate}
            onChange={setMeetingDate}
          />
          <Field label="Conteúdo / lição" value={lesson} onChange={setLesson} />
          <label className="full">
            Observações
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
        </div>
        <FormSection title={`Lista de presença (${members.length})`}>
          <div className="attendance-list">
            {members.map((person) => (
              <div key={person.id}>
                <span className="person-cell">
                  <span className="avatar blue">
                    {initials(person.full_name)}
                  </span>
                  <strong>{person.full_name}</strong>
                </span>
                <select
                  aria-label={`Presença de ${person.full_name}`}
                  value={statuses[person.id] ?? "absent"}
                  onChange={(event) =>
                    setStatuses((current) => ({
                      ...current,
                      [person.id]: event.target
                        .value as TeachingAttendance["status"],
                    }))
                  }
                >
                  <option value="present">Presente</option>
                  <option value="absent">Ausente</option>
                  <option value="justified">Justificado</option>
                  <option value="visitor">Visitante</option>
                </select>
              </div>
            ))}
            {!members.length && (
              <p className="inline-empty">
                Vincule pessoas a este grupo no cadastro para montar a chamada.
              </p>
            )}
          </div>
        </FormSection>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function EventForm({
  churchId,
  initialDate,
  initial,
  onClose,
  onSave,
}: {
  churchId: string;
  initialDate?: string;
  initial?: ChurchEvent;
  onClose: () => void;
  onSave: (e: ChurchEvent) => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    date:
      initial?.starts_at.slice(0, 10) ??
      initialDate ??
      new Date().toISOString().slice(0, 10),
    time: initial?.starts_at.slice(11, 16) || "19:00",
    end_time: initial?.ends_at?.slice(11, 16) || "20:30",
    location: initial?.location ?? "",
    description: initial?.description ?? "",
    color: initial?.color ?? "green",
    event_type: initial?.event_type ?? "general",
    image_consent_required: initial?.image_consent_required ?? false,
  });
  return (
    <ModalShell
      title={initial ? "Editar compromisso" : "Novo compromisso"}
      subtitle="AGENDA"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: initial?.id ?? newId(),
            church_id: initial?.church_id ?? churchId,
            title: form.title,
            description: form.description,
            starts_at: `${form.date}T${form.time}:00`,
            ends_at: `${form.date}T${form.end_time}:00`,
            location: form.location,
            color: form.color,
            all_day: initial?.all_day ?? false,
            event_type: form.event_type,
            image_consent_required: form.image_consent_required,
          });
        }}
      >
        <div className="form-grid modal-form">
          <Field
            label="Título"
            wide
            required
            value={form.title}
            onChange={(v) => setForm({ ...form, title: v })}
          />
          <Field
            label="Data"
            type="date"
            required
            value={form.date}
            onChange={(v) => setForm({ ...form, date: v })}
          />
          <Field
            label="Início"
            type="time"
            value={form.time}
            onChange={(v) => setForm({ ...form, time: v })}
          />
          <Field
            label="Término"
            type="time"
            value={form.end_time}
            onChange={(v) => setForm({ ...form, end_time: v })}
          />
          <Field
            label="Local"
            value={form.location}
            onChange={(v) => setForm({ ...form, location: v })}
          />
          <SelectField
            label="Tipo de compromisso"
            value={form.event_type}
            options={[
              "general|Evento geral",
              "worship|Culto",
              "teaching|Ensino",
              "meeting|Reunião",
              "department|Departamento",
            ]}
            raw
            onChange={(v) =>
              setForm({
                ...form,
                event_type: v,
                image_consent_required:
                  v === "worship" ? true : form.image_consent_required,
              })
            }
          />
          <SelectField
            label="Cor"
            value={form.color}
            options={[
              "green|Verde",
              "blue|Azul",
              "gold|Dourado",
              "coral|Coral",
            ]}
            raw
            onChange={(v) => setForm({ ...form, color: v })}
          />
          {form.event_type === "worship" && (
            <label className="check-row full">
              <input
                type="checkbox"
                checked={form.image_consent_required}
                onChange={(event) =>
                  setForm({
                    ...form,
                    image_consent_required: event.target.checked,
                  })
                }
              />
              Gerar uma autorização específica de uso de imagem para cada
              criança neste culto
            </label>
          )}
          <label className="full">
            Descrição
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}
function FinanceForm({
  churchId,
  accounts,
  categories,
  onClose,
  onSave,
}: {
  churchId: string;
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  onClose: () => void;
  onSave: (e: FinanceEntry) => void;
}) {
  const [form, setForm] = useState({
    description: "",
    type: "income" as "income" | "expense",
    amount: "",
    due_date: new Date().toISOString().slice(0, 10),
    status: "paid" as FinanceEntry["status"],
    account_id: accounts[0]?.id ?? "",
    category_id: "",
  });
  return (
    <ModalShell title="Novo lançamento" subtitle="FINANCEIRO" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: newId(),
            church_id: churchId,
            ...form,
            amount: Number(form.amount),
            account_id: form.account_id || undefined,
            category_id: form.category_id || undefined,
            paid_at:
              form.status === "paid" ? new Date().toISOString() : undefined,
          });
        }}
      >
        <div className="form-grid modal-form">
          <Field
            label="Descrição"
            wide
            required
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
          />
          <SelectField
            label="Tipo"
            value={form.type}
            options={["income|Receita", "expense|Despesa"]}
            raw
            onChange={(v) =>
              setForm({
                ...form,
                type: v as "income" | "expense",
                category_id: "",
              })
            }
          />
          <SelectField
            label="Conta"
            value={form.account_id}
            options={accounts.map((account) => `${account.id}|${account.name}`)}
            raw
            onChange={(v) => setForm({ ...form, account_id: v })}
          />
          <SelectField
            label="Categoria"
            value={form.category_id}
            options={categories
              .filter((category) => category.type === form.type)
              .map((category) => `${category.id}|${category.name}`)}
            raw
            onChange={(v) => setForm({ ...form, category_id: v })}
          />
          <Field
            label="Valor"
            type="number"
            required
            value={form.amount}
            onChange={(v) => setForm({ ...form, amount: v })}
          />
          <Field
            label="Vencimento"
            type="date"
            value={form.due_date}
            onChange={(v) => setForm({ ...form, due_date: v })}
          />
          <SelectField
            label="Situação"
            value={form.status}
            options={["paid|Pago", "pending|Pendente", "cancelled|Cancelado"]}
            raw
            onChange={(v) =>
              setForm({ ...form, status: v as FinanceEntry["status"] })
            }
          />
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function FinancialAccountForm({
  churchId,
  onClose,
  onSave,
}: {
  churchId: string;
  onClose: () => void;
  onSave: (account: FinancialAccount) => void;
}) {
  const [form, setForm] = useState({ name: "", opening_balance: "0" });
  return (
    <ModalShell title="Nova conta" subtitle="FINANCEIRO" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: newId(),
            church_id: churchId,
            name: form.name,
            opening_balance: Number(form.opening_balance),
            active: true,
          });
        }}
      >
        <div className="form-grid modal-form">
          <Field
            label="Nome da conta"
            wide
            required
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <Field
            label="Saldo inicial"
            type="number"
            value={form.opening_balance}
            onChange={(value) => setForm({ ...form, opening_balance: value })}
          />
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function FinancialCategoryForm({
  churchId,
  onClose,
  onSave,
}: {
  churchId: string;
  onClose: () => void;
  onSave: (category: FinancialCategory) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "income" as "income" | "expense",
  });
  return (
    <ModalShell title="Nova categoria" subtitle="FINANCEIRO" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({ id: newId(), church_id: churchId, ...form });
        }}
      >
        <div className="form-grid modal-form">
          <Field
            label="Nome da categoria"
            wide
            required
            value={form.name}
            onChange={(value) => setForm({ ...form, name: value })}
          />
          <SelectField
            label="Tipo"
            value={form.type}
            raw
            options={["income|Receita", "expense|Despesa"]}
            onChange={(value) =>
              setForm({ ...form, type: value as "income" | "expense" })
            }
          />
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function ChurchForm({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (
    c: Church,
    manager: { fullName: string; email: string; password: string },
  ) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    document: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    managerName: "",
    managerEmail: "",
    managerPassword: "",
  });
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  return (
    <ModalShell
      title="Nova igreja"
      subtitle="AMBIENTE MASTER"
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const { managerName, managerEmail, managerPassword, ...church } =
            form;
          onSave(
            { id: newId(), ...church, active: true },
            {
              fullName: managerName,
              email: managerEmail,
              password: managerPassword,
            },
          );
        }}
      >
        <div className="form-grid modal-form">
          <Field
            label="Nome da igreja"
            wide
            required
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
          />
          <Field
            label="CNPJ"
            value={form.document}
            onChange={(v) => setForm({ ...form, document: v })}
          />
          <Field
            label="Telefone"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
          />
          <Field
            label="E-mail"
            type="email"
            wide
            value={form.email}
            onChange={(v) => setForm({ ...form, email: v })}
          />
          <Field
            label="Cidade"
            value={form.city}
            onChange={(v) => setForm({ ...form, city: v })}
          />
          <Field
            label="Estado"
            value={form.state}
            onChange={(v) => setForm({ ...form, state: v })}
          />
          <div className="full manager-divider">
            <ShieldCheck />
            <span>
              <strong>Gestor Geral da igreja</strong>
              <small>Receberá acesso total somente a esta igreja.</small>
            </span>
          </div>
          <Field
            label="Nome completo do Gestor Geral"
            wide
            required
            value={form.managerName}
            onChange={(v) => setForm({ ...form, managerName: v })}
          />
          <Field
            label="E-mail de acesso do Gestor Geral"
            type="email"
            wide
            required
            value={form.managerEmail}
            onChange={(v) => setForm({ ...form, managerEmail: v })}
          />
          <label className="full login-field">
            Senha provisória do Gestor Geral
            <div className="password input-with-icon manager-password">
              <LockKeyhole />
              <input
                aria-label="Senha provisória do Gestor Geral"
                type={showManagerPassword ? "text" : "password"}
                minLength={8}
                required
                autoComplete="new-password"
                value={form.managerPassword}
                onChange={(event) =>
                  setForm({ ...form, managerPassword: event.target.value })
                }
              />
              <button
                type="button"
                className="password-toggle"
                aria-label={
                  showManagerPassword
                    ? "Ocultar senha provisória"
                    : "Mostrar senha provisória"
                }
                onClick={() => setShowManagerPassword((current) => !current)}
              >
                {showManagerPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <small>
              Use no mínimo 8 caracteres e entregue a senha por um canal seguro.
            </small>
          </label>
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  large,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  large?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="modal-layer">
      <button className="scrim fixed" onClick={onClose} />
      <div className={`modal ${large ? "large" : ""}`}>
        <div className="modal-head">
          <div>
            <span className="eyebrow">{subtitle}</span>
            <h2>{title}</h2>
          </div>
          <button className="icon-only" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
function ModalActions({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-actions">
      <button type="button" className="secondary" onClick={onClose}>
        Cancelar
      </button>
      <button className="primary">
        <Check />
        Salvar
      </button>
    </div>
  );
}
function FormSection({
  title,
  children,
  required,
}: {
  title: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <fieldset className="form-section">
      <legend>
        {title}
        {required && (
          <b className="required-mark" aria-hidden="true">
            {" "}
            *
          </b>
        )}
      </legend>
      {children}
    </fieldset>
  );
}
type CepAddress = Pick<
  Person["address"],
  "street" | "district" | "city" | "state" | "zip"
>;
function CepField({
  value,
  onChange,
  onAddress,
  required,
}: {
  value?: string;
  onChange: (value: string) => void;
  onAddress: (address: CepAddress) => void;
  required?: boolean;
}) {
  const [loadingCep, setLoadingCep] = useState(false),
    [cepError, setCepError] = useState("");
  async function searchCep() {
    const cep = (value ?? "").replace(/\D/g, "");
    if (cep.length !== 8) {
      setCepError("Digite um CEP com 8 números.");
      return;
    }
    setLoadingCep(true);
    setCepError("");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!response.ok) throw new Error("Não foi possível consultar o CEP.");
      const data = (await response.json()) as {
        erro?: boolean;
        cep?: string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (data.erro) throw new Error("CEP não encontrado.");
      onAddress({
        zip: data.cep ?? value,
        street: data.logradouro ?? "",
        district: data.bairro ?? "",
        city: data.localidade ?? "",
        state: data.uf ?? "",
      });
    } catch (reason) {
      setCepError(friendlyErrorMessage(reason, "CEP não encontrado."));
    } finally {
      setLoadingCep(false);
    }
  }
  return (
    <label className="cep-field">
      <span className="field-caption">
        CEP
        {required && (
          <b className="required-mark" aria-hidden="true">
            {" "}
            *
          </b>
        )}
      </span>
      <span>
        <input
          required={required}
          inputMode="numeric"
          placeholder="00000-000"
          value={value ?? ""}
          onChange={(event) => onChange(maskCep(event.target.value))}
          onBlur={() => void searchCep()}
        />
        <button
          type="button"
          className="secondary"
          disabled={loadingCep}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => void searchCep()}
        >
          {loadingCep ? <LoaderCircle className="spin" /> : <Search />}
          Buscar
        </button>
      </span>
      {cepError && <small className="field-error">{cepError}</small>}
    </label>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  wide,
  placeholder,
  inputMode,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  wide?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <label className={wide ? "full" : ""}>
      <span className="field-caption">
        {label}
        {required && (
          <b className="required-mark" aria-hidden="true">
            {" "}
            *
          </b>
        )}
      </span>
      <input
        type={type}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
function SelectField({
  label,
  value,
  options,
  onChange,
  raw,
  required,
}: {
  label: string;
  value?: string;
  options: string[];
  onChange: (v: string) => void;
  raw?: boolean;
  required?: boolean;
}) {
  return (
    <label>
      <span className="field-caption">
        {label}
        {required && (
          <b className="required-mark" aria-hidden="true">
            {" "}
            *
          </b>
        )}
      </span>
      <select
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Selecione</option>
        {options.map((option) => {
          const [key, text] = raw ? option.split("|") : [option, option];
          return (
            <option value={key} key={key}>
              {text}
            </option>
          );
        })}
      </select>
    </label>
  );
}
function CheckCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className={`check-card ${checked ? "checked" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{checked && <Check />}</span>
      {label}
    </label>
  );
}
function weekday(day?: number) {
  return day === undefined
    ? "Dia a definir"
    : ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"][
        day
      ];
}
function currency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}
function maskBrazilianDate(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
function maskCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
function maskCep(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}
function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
function toBrazilianDate(value?: string) {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}
function brazilianDateToIso(value?: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value ?? "");
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  )
    return null;
  return `${year}-${month}-${day}`;
}
function personAge(value?: string) {
  const isoDate = brazilianDateToIso(value);
  if (!isoDate) return null;
  const birthDate = new Date(`${isoDate}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  )
    age -= 1;
  return age >= 0 ? age : null;
}
function familyChildrenError(
  children: FamilyChildInput[],
  childLabel = "filho",
) {
  if (!children.length)
    return `Adicione pelo menos um ${childLabel} antes de continuar.`;
  for (const [index, child] of children.entries()) {
    const label = `${childLabel.charAt(0).toUpperCase()}${childLabel.slice(1)} ${index + 1}`;
    if (child.full_name.trim().length < 3)
      return `${label}: informe o nome completo.`;
    if (!brazilianDateToIso(child.birth_date))
      return `${label}: informe a data de nascimento em dd/mm/aaaa.`;
    if (personAge(child.birth_date) === null)
      return `${label}: a data de nascimento não pode ser futura.`;
    if (child.document_cpf.replace(/\D/g, "").length !== 11)
      return `${label}: informe um CPF com 11 números.`;
    if (!["Homem", "Mulher", "Prefiro não informar"].includes(child.gender))
      return `${label}: informe o sexo.`;
  }
  return "";
}
function dateTime(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const authorizationToken = params.get("authorization");
  const registrationToken = params.get("cadastro");
  return authorizationToken ? (
    <PublicAuthorizationPage token={authorizationToken} />
  ) : registrationToken ? (
    <PublicChurchRegistrationPage token={registrationToken} />
  ) : (
    <AuthenticatedApp />
  );
}

export default App;
