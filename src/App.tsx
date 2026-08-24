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
  Eye,
  EyeOff,
  FileSignature,
  GraduationCap,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
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
  ChildCheckin,
  ChildProfile,
  Department,
  DepartmentAssignment,
  emptyConsent,
  emptyWorkspace,
  FinancialAccount,
  FinancialCategory,
  FinanceEntry,
  generateKidsAuthorizations,
  getOrCreateChurchRegistrationLink,
  checkInChild,
  checkOutChild,
  deleteDepartment,
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
  saveDepartment,
  saveEvent,
  saveFinancialAccount,
  saveFinancialCategory,
  saveGroup,
  savePerson,
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
  | { type: "child-checkin"; eventId: string; childId: string }
  | { type: "department"; department?: Department }
  | { type: "department-delete"; department: Department }
  | { type: "teaching-meeting"; group: TeachingGroup }
  | { type: "event"; date?: string }
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
      setToast({ message, type });
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
          `Não foi possível carregar os dados: ${error.message}`,
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
        error instanceof Error ? error.message : "Não foi possível salvar.",
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
                groups={workspace.groups}
                onBack={() => setSelectedPerson(null)}
                onEdit={() =>
                  setModal({ type: "person", person: selectedPerson })
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
              onCheckin={(eventId, childId) =>
                setModal({ type: "child-checkin", eventId, childId })
              }
              onGenerate={(eventId) =>
                persist(
                  () => generateKidsAuthorizations(workspace, eventId),
                  "Autorizações pendentes geradas para este culto.",
                )
              }
              onCheckout={(checkinId, pickupBy) =>
                persist(
                  () => checkOutChild(workspace, checkinId, pickupBy),
                  "Saída registrada com segurança.",
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
          groups={workspace.groups}
          initial={modal.person}
          onClose={() => setModal(null)}
          onSave={(person) =>
            persist(
              () => savePerson(workspace, person),
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
      {modal?.type === "child-checkin" && (
        <ChildCheckinForm
          churchId={churchId}
          eventId={modal.eventId}
          childId={modal.childId}
          data={workspace}
          onClose={() => setModal(null)}
          onSave={(checkin) =>
            persist(
              () => checkInChild(workspace, checkin),
              "Entrada da criança registrada.",
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
          onClose={() => setModal(null)}
          onSave={(event) =>
            persist(
              () => saveEvent(workspace, event),
              "Compromisso adicionado.",
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
      setError(
        err instanceof Error
          ? translateAuthError(err.message)
          : "Não foi possível entrar.",
      );
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
      <span>
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
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o link de cadastro.",
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
                  <small>
                    {p.preferred_name
                      ? `Prefere ${p.preferred_name}`
                      : p.email || "Sem e-mail"}
                  </small>
                </span>
              </span>
              <span>{p.phone_primary || "Não informado"}</span>
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
  groups,
  onBack,
  onEdit,
}: {
  person: Person;
  groups: TeachingGroup[];
  onBack: () => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<"info" | "church" | "consent">("info"),
    age = person.birth_date
      ? Math.floor(
          (Date.now() - new Date(person.birth_date).getTime()) / 31557600000,
        )
      : null,
    personGroups = groups.filter((group) =>
      person.group_ids.includes(group.id),
    );
  return (
    <>
      <div className="detail-head">
        <button className="back-button" onClick={onBack}>
          <ArrowLeft />
          Voltar
        </button>
        <button className="primary" onClick={onEdit}>
          <Pencil />
          Editar cadastro
        </button>
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
                {person.phone_primary}
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
          Informações
        </button>
        <button
          className={tab === "church" ? "active" : ""}
          onClick={() => setTab("church")}
        >
          Vida na igreja
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
            title="Dados pessoais"
            icon={UserRound}
            rows={[
              ["Nome preferido", person.preferred_name],
              [
                "Nascimento",
                person.birth_date ? formatDate(person.birth_date) : undefined,
              ],
              ["Gênero", person.gender],
              ["Escolaridade", person.education],
              ["Estado civil", person.marital_status],
              ["Cônjuge", person.spouse_name],
              ["CPF", person.document_cpf],
              ["RG", person.document_rg],
            ]}
          />
          <InfoCard
            title="Contato e endereço"
            icon={Phone}
            rows={[
              ["Telefone principal", person.phone_primary],
              ["Telefone alternativo", person.phone_secondary],
              ["E-mail", person.email],
              [
                "Endereço",
                [person.address.street, person.address.number]
                  .filter(Boolean)
                  .join(", "),
              ],
              ["Bairro", person.address.district],
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
            title="Anotações"
            icon={Pencil}
            rows={[["Observações", person.notes]]}
          />
        </div>
      )}
      {tab === "church" && (
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
                "Batizado(a)",
                person.baptized === undefined
                  ? undefined
                  : person.baptized
                    ? "Sim"
                    : "Não",
              ],
              ["Categorias", person.categories.join(", ")],
              ["Cargos e funções", person.ministry_roles.join(", ")],
            ]}
          />
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
                  <small>{g.track}</small>
                </span>
              </div>
            ))}
            {!personGroups.length && (
              <p className="inline-empty">Nenhum grupo vinculado.</p>
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
  groups,
  initial,
  onClose,
  onSave,
}: {
  churchId: string;
  groups: TeachingGroup[];
  initial?: Person;
  onClose: () => void;
  onSave: (p: Person) => void;
}) {
  const [form, setForm] = useState<Person>(
      initial
        ? structuredClone(initial)
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
    );
  const set = <K extends keyof Person>(key: K, value: Person[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    address = (key: keyof Person["address"], value: string) =>
      setForm((prev) => ({
        ...prev,
        address: { ...prev.address, [key]: value },
      })),
    toggleList = (key: "categories" | "ministry_roles", value: string) =>
      set(
        key,
        form[key].includes(value)
          ? form[key].filter((v) => v !== value)
          : [...form[key], value],
      );
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
          onSave(form);
        }}
      >
        <div className="form-tabs">
          <button
            type="button"
            className={section === "personal" ? "active" : ""}
            onClick={() => setSection("personal")}
          >
            1. Dados pessoais
          </button>
          <button
            type="button"
            className={section === "church" ? "active" : ""}
            onClick={() => setSection("church")}
          >
            2. Vida na igreja
          </button>
          <button
            type="button"
            className={section === "consent" ? "active" : ""}
            onClick={() => setSection("consent")}
          >
            3. Consentimentos
          </button>
        </div>
        <div className="form-scroll">
          {section === "personal" && (
            <>
              <FormSection title="Identificação">
                <div className="form-grid">
                  <Field
                    label="Nome completo"
                    wide
                    required
                    value={form.full_name}
                    onChange={(v) => set("full_name", v)}
                  />
                  <Field
                    label="Nome preferido"
                    value={form.preferred_name}
                    onChange={(v) => set("preferred_name", v)}
                  />
                  <Field
                    label="Data de nascimento"
                    type="date"
                    value={form.birth_date}
                    onChange={(v) => set("birth_date", v)}
                  />
                  <SelectField
                    label="Gênero"
                    value={form.gender}
                    options={[
                      "Feminino",
                      "Masculino",
                      "Não binário",
                      "Prefiro não informar",
                    ]}
                    onChange={(v) => set("gender", v)}
                  />
                  <SelectField
                    label="Escolaridade"
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
                    value={form.marital_status}
                    options={[
                      "Solteiro(a)",
                      "Casado(a)",
                      "Divorciado(a)",
                      "Viúvo(a)",
                      "União estável",
                    ]}
                    onChange={(v) => set("marital_status", v)}
                  />
                  <Field
                    label="Nome do cônjuge"
                    value={form.spouse_name}
                    onChange={(v) => set("spouse_name", v)}
                  />
                  <Field
                    label="CPF"
                    value={form.document_cpf}
                    onChange={(v) => set("document_cpf", v)}
                  />
                  <Field
                    label="RG"
                    value={form.document_rg}
                    onChange={(v) => set("document_rg", v)}
                  />
                </div>
              </FormSection>
              <FormSection title="Contato">
                <div className="form-grid">
                  <Field
                    label="Telefone principal"
                    value={form.phone_primary}
                    onChange={(v) => set("phone_primary", v)}
                  />
                  <Field
                    label="Telefone alternativo"
                    value={form.phone_secondary}
                    onChange={(v) => set("phone_secondary", v)}
                  />
                  <Field
                    label="E-mail"
                    type="email"
                    wide
                    value={form.email}
                    onChange={(v) => set("email", v)}
                  />
                </div>
              </FormSection>
              <FormSection title="Endereço">
                <div className="form-grid">
                  <Field
                    label="Endereço"
                    wide
                    value={form.address.street}
                    onChange={(v) => address("street", v)}
                  />
                  <Field
                    label="Número"
                    value={form.address.number}
                    onChange={(v) => address("number", v)}
                  />
                  <Field
                    label="Bairro"
                    value={form.address.district}
                    onChange={(v) => address("district", v)}
                  />
                  <Field
                    label="CEP"
                    value={form.address.zip}
                    onChange={(v) => address("zip", v)}
                  />
                  <Field
                    label="Cidade"
                    value={form.address.city}
                    onChange={(v) => address("city", v)}
                  />
                  <Field
                    label="Estado"
                    value={form.address.state}
                    onChange={(v) => address("state", v)}
                  />
                  <Field
                    label="País"
                    value={form.address.country}
                    onChange={(v) => address("country", v)}
                  />
                </div>
              </FormSection>
            </>
          )}
          {section === "church" && (
            <>
              <FormSection title="Jornada espiritual">
                <div className="form-grid">
                  <Field
                    label="Data de conversão"
                    type="date"
                    value={form.conversion_date}
                    onChange={(v) => set("conversion_date", v)}
                  />
                  <SelectField
                    label="Batizado(a)"
                    value={
                      form.baptized === undefined
                        ? ""
                        : form.baptized
                          ? "Sim"
                          : "Não"
                    }
                    options={["Sim", "Não"]}
                    onChange={(v) => set("baptized", v === "Sim")}
                  />
                </div>
              </FormSection>
              <FormSection title="Categorias">
                <div className="check-grid">
                  {[
                    "Criança",
                    "Adolescente",
                    "Visitante",
                    "Novo convertido",
                    "Congregado",
                    "Membro",
                    "Responsável",
                    "Líder",
                    "Pastor(a)",
                  ].map((v) => (
                    <CheckCard
                      key={v}
                      label={v}
                      checked={form.categories.includes(v)}
                      onChange={() => toggleList("categories", v)}
                    />
                  ))}
                </div>
              </FormSection>
              <FormSection title="Cargos ou funções">
                <div className="check-grid">
                  {[
                    "Liderança",
                    "Louvor",
                    "Ensino",
                    "Diaconia",
                    "Mídia",
                    "Infantil",
                    "Intercessão",
                    "Tesouraria",
                  ].map((v) => (
                    <CheckCard
                      key={v}
                      label={v}
                      checked={form.ministry_roles.includes(v)}
                      onChange={() => toggleList("ministry_roles", v)}
                    />
                  ))}
                </div>
              </FormSection>
              <FormSection title="Grupos de ensino">
                <div className="check-grid">
                  {groups.map((group) => (
                    <CheckCard
                      key={group.id}
                      label={group.name}
                      checked={form.group_ids.includes(group.id)}
                      onChange={() =>
                        set(
                          "group_ids",
                          form.group_ids.includes(group.id)
                            ? form.group_ids.filter((id) => id !== group.id)
                            : [...form.group_ids, group.id],
                        )
                      }
                    />
                  ))}
                </div>
                {!groups.length && (
                  <p className="inline-empty">
                    Cadastre um grupo no módulo Ensino para criar vínculos.
                  </p>
                )}
              </FormSection>
              <label className="standalone-label">
                Anotações pastorais
                <textarea
                  rows={5}
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
              onClick={() =>
                setSection(section === "personal" ? "church" : "consent")
              }
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
  onCheckin,
  onGenerate,
  onCheckout,
  notify,
}: {
  data: WorkspaceData;
  onAddChild: () => void;
  onAuthorization: (authorization: ChildAuthorization) => void;
  onCheckin: (eventId: string, childId: string) => void;
  onGenerate: (eventId: string) => void;
  onCheckout: (checkinId: string, pickupBy: string) => void;
  notify: (message: string) => void;
}) {
  const services = data.events.filter(
    (event) => event.event_type === "worship",
  );
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [tab, setTab] = useState<"children" | "authorizations" | "checkin">(
    "authorizations",
  );
  const selectedService = services.find((event) => event.id === serviceId);
  const authorizations = data.childAuthorizations.filter(
    (item) => item.event_id === serviceId,
  );
  const checkins = data.childCheckins.filter(
    (item) => item.event_id === serviceId,
  );
  const childPerson = (childId: string) =>
    data.people.find((person) => person.id === childId);
  const guardianName = (childId: string) => {
    const link =
      data.guardians.find(
        (guardian) => guardian.child_id === childId && guardian.primary_contact,
      ) ?? data.guardians.find((guardian) => guardian.child_id === childId);
    return (
      data.people.find((person) => person.id === link?.guardian_person_id)
        ?.full_name ?? "Responsável não vinculado"
    );
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
        text="Crianças, responsáveis, autorizações por culto e check-in seguro em um único fluxo."
        action="Nova criança"
        onAction={onAddChild}
      />
      <section className="kids-service-bar card">
        <div>
          <span className="metric-icon">
            <QrCode />
          </span>
          <label>
            Culto em operação
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
            Gerar pendentes
          </button>
          <button className="primary" onClick={() => setTab("checkin")}>
            <ClipboardCheck />
            Abrir check-in
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
        <Metric
          icon={ClipboardCheck}
          label="Presentes"
          value={String(checkins.filter((item) => !item.checkout_at).length)}
          detail="check-ins ativos"
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
          className={tab === "authorizations" ? "active" : ""}
          onClick={() => setTab("authorizations")}
        >
          Autorizações por culto
        </button>
        <button
          className={tab === "checkin" ? "active" : ""}
          onClick={() => setTab("checkin")}
        >
          Check-in e saída
        </button>
      </div>
      {tab === "children" && (
        <div className="children-grid">
          {data.children.map((child) => {
            const person = childPerson(child.person_id);
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
                    <dt>Responsável</dt>
                    <dd>{guardianName(child.person_id)}</dd>
                  </div>
                  <div>
                    <dt>Emergência</dt>
                    <dd>{child.emergency_contact_phone || "Não informado"}</dd>
                  </div>
                  <div>
                    <dt>Alergias</dt>
                    <dd>{child.allergies || "Nenhuma informada"}</dd>
                  </div>
                  <div>
                    <dt>Necessidades</dt>
                    <dd>{child.special_needs || "Nenhuma informada"}</dd>
                  </div>
                </dl>
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
                  <small>{guardianName(authorization.child_id)}</small>
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
              Clique em “Gerar pendentes” para criar uma autorização individual
              para cada criança.
            </p>
          )}
        </section>
      )}
      {tab === "checkin" && (
        <section className="checkin-board">
          {data.children.map((child) => {
            const person = childPerson(child.person_id),
              authorization = authorizations.find(
                (item) => item.child_id === child.person_id,
              ),
              checkin = checkins.find(
                (item) => item.child_id === child.person_id,
              );
            return (
              <article
                className={`card checkin-card ${checkin && !checkin.checkout_at ? "checked-in" : ""}`}
                key={child.person_id}
              >
                <div>
                  <span className="avatar coral">
                    {initials(person?.full_name ?? "C")}
                  </span>
                  <span>
                    <strong>{person?.full_name}</strong>
                    <small>{guardianName(child.person_id)}</small>
                  </span>
                </div>
                <div className="checkin-flags">
                  <b
                    className={`authorization-status ${authorization?.decision ?? "pending"}`}
                  >
                    {authorizationDecision(
                      authorization?.decision ?? "pending",
                    )}
                  </b>
                  {checkin && !checkin.checkout_at && (
                    <b className="status">
                      Presente desde{" "}
                      {new Date(checkin.checkin_at).toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </b>
                  )}
                </div>
                {!checkin ? (
                  <button
                    className="primary"
                    disabled={!serviceId}
                    onClick={() => onCheckin(serviceId, child.person_id)}
                  >
                    <ClipboardCheck />
                    Fazer check-in
                  </button>
                ) : !checkin.checkout_at ? (
                  <button
                    className="secondary"
                    onClick={() => {
                      const pickup = window.prompt(
                        "Nome completo de quem está retirando a criança:",
                      );
                      if (pickup) onCheckout(checkin.id, pickup);
                    }}
                  >
                    <LogOut />
                    Registrar saída
                  </button>
                ) : (
                  <span className="checkout-done">
                    <Check />
                    Retirada por {checkin.pickup_by}
                  </span>
                )}
              </article>
            );
          })}
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
function ageFromDate(date: string) {
  const today = new Date(),
    birth = new Date(`${date}T12:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()))
    age--;
  return age;
}
function printChildAuthorization(
  authorization: ChildAuthorization,
  data: WorkspaceData,
) {
  const child = data.people.find(
      (person) => person.id === authorization.child_id,
    ),
    guardian = data.people.find(
      (person) => person.id === authorization.guardian_id,
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
  popup.document.write(
    `<!doctype html><html lang="pt-BR"><head><title>Autorização de imagem</title><style>body{font:16px Arial;color:#172b27;padding:54px;line-height:1.55}h1{font-size:25px}h2{font-size:17px;margin-top:32px}.box{border:1px solid #cad7d2;border-radius:12px;padding:18px;margin:20px 0}.decision{font-weight:bold;font-size:18px}.signature{margin-top:70px;border-top:1px solid #172b27;padding-top:8px;width:70%}@media print{button{display:none}}</style></head><body><h1>Autorização específica de uso de imagem — criança</h1><p><strong>${safe(church?.name)}</strong></p><div class="box"><p><strong>Criança:</strong> ${safe(child?.full_name)}</p><p><strong>Responsável:</strong> ${safe(authorization.signed_name || guardian?.full_name)}</p><p><strong>Culto:</strong> ${safe(event?.title)} — ${safe(event ? dateTime(event.starts_at) : "")}</p></div><p>${safe(authorization.consent_text_snapshot)}</p><h2>Decisão registrada</h2><p class="decision">${authorizationDecision(authorization.decision)}</p><p>Fotografia: ${authorization.allow_photo ? "SIM" : "NÃO"}<br>Vídeo: ${authorization.allow_video ? "SIM" : "NÃO"}<br>Publicação nas redes sociais: ${authorization.allow_social_media ? "SIM" : "NÃO"}</p><p class="signature">${safe(authorization.signed_name || "Assinatura do responsável")}</p><p>Registrado em: ${authorization.signed_at ? safe(dateTime(authorization.signed_at)) : "Pendente de manifestação"}</p><button onclick="window.print()">Imprimir</button></body></html>`,
  );
  popup.document.close();
  popup.focus();
}

function ChildForm({
  churchId,
  people,
  onClose,
  onSave,
}: {
  churchId: string;
  people: Person[];
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
    guardianId: "",
    relationship: "Mãe",
    emergencyName: "",
    emergencyPhone: "",
    allergies: "",
    medicalNotes: "",
    specialNeeds: "",
    pickupPeople: "",
  });
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
          const personId = newId(),
            person: Person = {
              id: personId,
              church_id: churchId,
              full_name: form.fullName,
              birth_date: form.birthDate,
              address: { country: "Brasil" },
              categories: ["Criança"],
              ministry_roles: [],
              group_ids: [],
              active: true,
              consent: { ...emptyConsent, data_processing: true },
            },
            profile: ChildProfile = {
              person_id: personId,
              church_id: churchId,
              emergency_contact_name: form.emergencyName,
              emergency_contact_phone: form.emergencyPhone,
              allergies: form.allergies,
              medical_notes: form.medicalNotes,
              special_needs: form.specialNeeds,
              authorized_pickup_people: form.pickupPeople
                .split("\n")
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name })),
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
                label="Nome completo"
                wide
                required
                value={form.fullName}
                onChange={(value) => setForm({ ...form, fullName: value })}
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
                onChange={(value) => {
                  const guardian = people.find((person) => person.id === value);
                  setForm({
                    ...form,
                    guardianId: value,
                    emergencyName: guardian?.full_name ?? form.emergencyName,
                    emergencyPhone:
                      guardian?.phone_primary ?? form.emergencyPhone,
                  });
                }}
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
              <Field
                label="Contato de emergência"
                value={form.emergencyName}
                onChange={(value) => setForm({ ...form, emergencyName: value })}
              />
              <Field
                label="Telefone de emergência"
                value={form.emergencyPhone}
                onChange={(value) =>
                  setForm({ ...form, emergencyPhone: value })
                }
              />
            </div>
          </FormSection>
          <FormSection title="Saúde e acolhimento">
            <div className="form-grid">
              <label>
                Alergias
                <textarea
                  rows={3}
                  value={form.allergies}
                  onChange={(event) =>
                    setForm({ ...form, allergies: event.target.value })
                  }
                />
              </label>
              <label>
                Informações médicas
                <textarea
                  rows={3}
                  value={form.medicalNotes}
                  onChange={(event) =>
                    setForm({ ...form, medicalNotes: event.target.value })
                  }
                />
              </label>
              <label className="full">
                Necessidades específicas de cuidado
                <textarea
                  rows={3}
                  value={form.specialNeeds}
                  onChange={(event) =>
                    setForm({ ...form, specialNeeds: event.target.value })
                  }
                />
              </label>
              <label className="full">
                Outras pessoas autorizadas a retirar — uma por linha
                <textarea
                  rows={3}
                  value={form.pickupPeople}
                  onChange={(event) =>
                    setForm({ ...form, pickupPeople: event.target.value })
                  }
                />
              </label>
            </div>
          </FormSection>
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
        </div>
        <ModalActions onClose={onClose} />
      </form>
    </ModalShell>
  );
}

function ChildCheckinForm({
  churchId,
  eventId,
  childId,
  data,
  onClose,
  onSave,
}: {
  churchId: string;
  eventId: string;
  childId: string;
  data: WorkspaceData;
  onClose: () => void;
  onSave: (checkin: ChildCheckin) => void;
}) {
  const child = data.people.find((person) => person.id === childId),
    guardianLinks = data.guardians.filter(
      (item) => item.child_id === childId && item.can_pickup,
    ),
    authorization = data.childAuthorizations.find(
      (item) => item.event_id === eventId && item.child_id === childId,
    ),
    [form, setForm] = useState({
      guardianId: guardianLinks[0]?.guardian_person_id ?? "",
      notes: "",
      pickupCode: String(Math.floor(1000 + Math.random() * 9000)),
    });
  return (
    <ModalShell
      title="Check-in da criança"
      subtitle="KIDS • ENTRADA SEGURA"
      onClose={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            id: newId(),
            church_id: churchId,
            event_id: eventId,
            child_id: childId,
            guardian_id: form.guardianId || undefined,
            authorization_id: authorization?.id,
            checkin_at: new Date().toISOString(),
            pickup_code: form.pickupCode,
            notes: form.notes,
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
                Autorização de imagem:{" "}
                {authorizationDecision(authorization?.decision ?? "pending")}
              </small>
            </span>
          </div>
          {authorization?.decision !== "authorized" && (
            <div className="kids-warning coral-warning">
              <Camera />
              <span>
                <strong>Não fotografar nem filmar</strong>A participação e o
                check-in continuam normalmente.
              </span>
            </div>
          )}
          <div className="form-grid">
            <SelectField
              label="Responsável pela entrada"
              value={form.guardianId}
              raw
              required
              options={guardianLinks.map(
                (link) =>
                  `${link.guardian_person_id}|${data.people.find((person) => person.id === link.guardian_person_id)?.full_name ?? "Responsável"}`,
              )}
              onChange={(value) => setForm({ ...form, guardianId: value })}
            />
            <Field
              label="Código de retirada"
              value={form.pickupCode}
              onChange={(value) => setForm({ ...form, pickupCode: value })}
            />
            <label className="full">
              Observações do check-in
              <textarea
                rows={3}
                value={form.notes}
                onChange={(event) =>
                  setForm({ ...form, notes: event.target.value })
                }
              />
            </label>
          </div>
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
  const roleOptions = form.roles
    .split("\n")
    .map((role) => role.trim())
    .filter(Boolean);
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
            <div className="check-grid">
              {data.people.map((person) => (
                <CheckCard
                  key={person.id}
                  label={person.full_name}
                  checked={Boolean(form.assignments[person.id])}
                  onChange={() => {
                    const assignments = { ...form.assignments };
                    if (assignments[person.id]) delete assignments[person.id];
                    else
                      assignments[person.id] = {
                        role_title: roleOptions[0] ?? "Participante",
                        can_manage: false,
                      };
                    setForm({ ...form, assignments });
                  }}
                />
              ))}
            </div>
            <div className="department-assignments">
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
                    </div>
                  );
                },
              )}
            </div>
          </div>
          <label className="full">
            Cargos e funções — um por linha
            <textarea
              rows={6}
              value={form.roles}
              onChange={(event) =>
                setForm({ ...form, roles: event.target.value })
              }
            />
          </label>
        </div>
        <ModalActions onClose={onClose} />
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
        if (!data) setError("Autorização não encontrada ou link inválido.");
      })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await respondPublicChildAuthorization(token, form);
      setDone(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível registrar.",
      );
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
    [form, setForm] = useState<SelfRegistrationInput>({
      full_name: "",
      preferred_name: "",
      birth_date: "",
      gender: "",
      marital_status: "",
      email: "",
      phone_primary: "",
      phone_secondary: "",
      address: { country: "Brasil" },
      conversion_date: "",
      baptized: undefined,
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
          reason instanceof Error
            ? reason.message
            : "Não foi possível abrir o cadastro.",
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
    if (!form.email?.trim() && !form.phone_primary?.trim()) {
      setError("Informe pelo menos um telefone ou e-mail para contato.");
      return;
    }
    setLoading(true);
    try {
      await submitPublicChurchRegistration(token, form);
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível enviar o cadastro.",
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
                    wide
                    value={form.full_name}
                    onChange={(full_name) => setForm({ ...form, full_name })}
                  />
                  <Field
                    label="Como prefere ser chamado(a)"
                    value={form.preferred_name}
                    onChange={(preferred_name) =>
                      setForm({ ...form, preferred_name })
                    }
                  />
                  <Field
                    label="Data de nascimento"
                    type="date"
                    value={form.birth_date}
                    onChange={(birth_date) => setForm({ ...form, birth_date })}
                  />
                  <SelectField
                    label="Sexo"
                    value={form.gender}
                    options={[
                      "Masculino",
                      "Feminino",
                      "Outro",
                      "Prefiro não informar",
                    ]}
                    onChange={(gender) => setForm({ ...form, gender })}
                  />
                  <SelectField
                    label="Estado civil"
                    value={form.marital_status}
                    options={[
                      "Solteiro(a)",
                      "Casado(a)",
                      "Divorciado(a)",
                      "Viúvo(a)",
                      "União estável",
                    ]}
                    onChange={(marital_status) =>
                      setForm({ ...form, marital_status })
                    }
                  />
                </div>
              </FormSection>

              <FormSection title="Contato">
                <div className="form-grid public-form-grid">
                  <Field
                    label="Telefone principal"
                    value={form.phone_primary}
                    onChange={(phone_primary) =>
                      setForm({ ...form, phone_primary })
                    }
                  />
                  <Field
                    label="Outro telefone"
                    value={form.phone_secondary}
                    onChange={(phone_secondary) =>
                      setForm({ ...form, phone_secondary })
                    }
                  />
                  <Field
                    label="E-mail"
                    type="email"
                    wide
                    value={form.email}
                    onChange={(email) => setForm({ ...form, email })}
                  />
                </div>
                <small className="field-help">
                  Informe ao menos um telefone ou e-mail.
                </small>
              </FormSection>

              <FormSection title="Endereço">
                <div className="form-grid public-form-grid">
                  <Field
                    label="Rua / endereço"
                    wide
                    value={form.address.street}
                    onChange={(value) => setAddress("street", value)}
                  />
                  <Field
                    label="Número"
                    value={form.address.number}
                    onChange={(value) => setAddress("number", value)}
                  />
                  <Field
                    label="Bairro"
                    value={form.address.district}
                    onChange={(value) => setAddress("district", value)}
                  />
                  <Field
                    label="CEP"
                    value={form.address.zip}
                    onChange={(value) => setAddress("zip", value)}
                  />
                  <Field
                    label="Cidade"
                    value={form.address.city}
                    onChange={(value) => setAddress("city", value)}
                  />
                  <Field
                    label="Estado"
                    value={form.address.state}
                    onChange={(value) => setAddress("state", value)}
                  />
                  <Field
                    label="País"
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
                  <SelectField
                    label="É batizado(a)?"
                    value={
                      form.baptized === undefined ? "" : String(form.baptized)
                    }
                    options={["true|Sim", "false|Não"]}
                    raw
                    onChange={(value) =>
                      setForm({
                        ...form,
                        baptized: value === "" ? undefined : value === "true",
                      })
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
}: {
  events: ChurchEvent[];
  onAdd: (date?: string) => void;
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
                <button
                  className="calendar-day"
                  key={i}
                  onClick={() =>
                    day &&
                    onAdd(
                      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
                    )
                  }
                >
                  {day && <span>{day}</span>}
                  {day &&
                    monthEvents
                      .filter((e) => new Date(e.starts_at).getDate() === day)
                      .map((e) => (
                        <b className={`cal-event ${e.color}`} key={e.id}>
                          {new Date(e.starts_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          {e.title}
                        </b>
                      ))}
                </button>
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
      .catch((error) => notify(error.message));
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
      notify(
        error instanceof Error ? error.message : "Não foi possível convidar.",
      );
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
  onClose,
  onSave,
}: {
  churchId: string;
  initialDate?: string;
  onClose: () => void;
  onSave: (e: ChurchEvent) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    date: initialDate ?? new Date().toISOString().slice(0, 10),
    time: "19:00",
    end_time: "20:30",
    location: "",
    description: "",
    color: "green",
    event_type: "general",
    image_consent_required: false,
  });
  return (
    <ModalShell title="Novo compromisso" subtitle="AGENDA" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: newId(),
            church_id: churchId,
            title: form.title,
            description: form.description,
            starts_at: `${form.date}T${form.time}:00`,
            ends_at: `${form.date}T${form.end_time}:00`,
            location: form.location,
            color: form.color,
            all_day: false,
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
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="form-section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}
function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  wide,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "full" : ""}>
      {label}
      <input
        type={type}
        required={required}
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
      {label}
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
