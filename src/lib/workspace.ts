import { isDemoMode, supabase } from "./supabase";

export type Role =
  "master" | "super" | "people" | "teaching" | "finance" | "agenda" | "viewer";

export type Church = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  document?: string;
  city?: string;
  state?: string;
  active: boolean;
};

export type Consent = {
  messaging: boolean;
  representatives_contact: boolean;
  event_filming: boolean;
  event_photography: boolean;
  data_processing: boolean;
  social_media_image: boolean;
  marketing: boolean;
};

export type Person = {
  id: string;
  church_id: string;
  full_name: string;
  birth_date?: string;
  gender?: string;
  education?: string;
  marital_status?: string;
  spouse_name?: string;
  children_names?: string[];
  conversion_date?: string;
  baptized?: boolean;
  baptism_date?: string;
  document_cpf?: string;
  email?: string;
  phone_primary?: string;
  phone_secondary?: string;
  address: {
    street?: string;
    number?: string;
    district?: string;
    complement?: string;
    zip?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  categories: string[];
  ministry_roles: string[];
  group_ids: string[];
  group_roles?: Record<string, string>;
  notes?: string;
  active: boolean;
  auth_user_id?: string;
  consent: Consent;
};

export type FamilyChildInput = {
  id?: string;
  full_name: string;
  birth_date: string;
  document_cpf: string;
};

export type TeachingGroup = {
  id: string;
  church_id: string;
  name: string;
  track: string;
  description?: string;
  leader_id?: string;
  weekday?: number;
  starts_at?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  capacity?: number;
  active: boolean;
  members?: number;
  member_ids?: string[];
  member_roles?: Record<string, string>;
};

export type ChurchEvent = {
  id: string;
  church_id: string;
  title: string;
  description?: string;
  starts_at: string;
  ends_at?: string;
  all_day: boolean;
  location?: string;
  color?: string;
  event_type?: string;
  image_consent_required?: boolean;
};

export type ChildProfile = {
  person_id: string;
  church_id: string;
  allergies?: string;
  medical_notes?: string;
  special_needs?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  authorized_pickup_people: { name: string; document?: string }[];
  pickup_code_required: boolean;
  active: boolean;
};

export type ChildGuardian = {
  id: string;
  church_id: string;
  child_id: string;
  guardian_person_id: string;
  relationship: string;
  legal_guardian: boolean;
  primary_contact: boolean;
  can_pickup: boolean;
};

export type ChildAuthorization = {
  id: string;
  church_id: string;
  event_id: string;
  child_id: string;
  guardian_id?: string;
  decision: "pending" | "authorized" | "denied" | "revoked";
  allow_photo: boolean;
  allow_video: boolean;
  allow_social_media: boolean;
  consent_version: string;
  consent_text_snapshot: string;
  signed_name?: string;
  signed_at?: string;
  revoked_at?: string;
  token: string;
  generated_at: string;
};

export type ChildCheckin = {
  id: string;
  church_id: string;
  event_id: string;
  child_id: string;
  guardian_id?: string;
  authorization_id?: string;
  checkin_at: string;
  checkout_at?: string;
  pickup_by?: string;
  pickup_code?: string;
  notes?: string;
};

export type Department = {
  id: string;
  church_id: string;
  name: string;
  department_type: string;
  description?: string;
  active: boolean;
};

export type DepartmentRole = {
  id: string;
  church_id: string;
  department_id: string;
  title: string;
  sort_order: number;
};
export type DepartmentMember = {
  church_id: string;
  department_id: string;
  person_id: string;
  role_id?: string;
  joined_at: string;
  active: boolean;
  can_manage?: boolean;
};

export type DepartmentAssignment = {
  person_id: string;
  role_title?: string;
  can_manage: boolean;
};

export type TeachingMeeting = {
  id: string;
  church_id: string;
  group_id: string;
  title: string;
  meeting_date: string;
  lesson?: string;
  notes?: string;
};
export type TeachingAttendance = {
  church_id: string;
  meeting_id: string;
  person_id: string;
  status: "present" | "absent" | "justified" | "visitor";
  notes?: string;
};

export type GroupMembershipHistory = {
  id: string;
  church_id: string;
  person_id: string;
  group_id: string;
  group_name: string;
  role_title?: string;
  action: "joined" | "removed";
  occurred_at: string;
};

export type PublicChildAuthorization = {
  authorization_id: string;
  church_name: string;
  event_title: string;
  event_starts_at: string;
  child_name: string;
  decision: ChildAuthorization["decision"];
  allow_photo: boolean;
  allow_video: boolean;
  allow_social_media: boolean;
  consent_text: string;
  signed_name?: string;
  signed_at?: string;
};

export type PublicChurchRegistration = {
  church_id: string;
  church_name: string;
  active: boolean;
  expires_at?: string;
};

export type SelfRegistrationInput = {
  full_name: string;
  birth_date?: string;
  gender?: string;
  education?: string;
  marital_status?: string;
  spouse_name?: string;
  document_cpf?: string;
  email?: string;
  phone_primary?: string;
  phone_secondary?: string;
  address: Person["address"];
  conversion_date?: string;
  baptism_date?: string;
  categories: string[];
  children: FamilyChildInput[];
  messaging_consent: boolean;
  data_processing_consent: boolean;
};

export type FinanceEntry = {
  id: string;
  church_id: string;
  description: string;
  type: "income" | "expense";
  status: "pending" | "paid" | "cancelled";
  amount: number;
  due_date: string;
  paid_at?: string;
  account_id?: string;
  category_id?: string;
};

export type FinancialAccount = {
  id: string;
  church_id: string;
  name: string;
  opening_balance: number;
  active: boolean;
};

export type FinancialCategory = {
  id: string;
  church_id: string;
  name: string;
  type: "income" | "expense";
};

export type WorkspaceData = {
  churches: Church[];
  people: Person[];
  groups: TeachingGroup[];
  events: ChurchEvent[];
  transactions: FinanceEntry[];
  accounts: FinancialAccount[];
  categories: FinancialCategory[];
  children: ChildProfile[];
  guardians: ChildGuardian[];
  childAuthorizations: ChildAuthorization[];
  childCheckins: ChildCheckin[];
  departments: Department[];
  departmentRoles: DepartmentRole[];
  departmentMembers: DepartmentMember[];
  teachingMeetings: TeachingMeeting[];
  teachingAttendance: TeachingAttendance[];
  groupHistory: GroupMembershipHistory[];
};

export type TeamMember = {
  id: string;
  user_id: string;
  full_name: string;
  role: Role;
  active: boolean;
};

const consentOff: Consent = {
  messaging: false,
  representatives_contact: false,
  event_filming: false,
  event_photography: false,
  data_processing: false,
  social_media_image: false,
  marketing: false,
};

const demoData: WorkspaceData = {
  churches: [
    {
      id: "demo-church",
      name: "Igreja da Promessa",
      email: "contato@igreja.org",
      phone: "(11) 4000-2026",
      city: "São Paulo",
      state: "SP",
      active: true,
    },
  ],
  people: [
    {
      id: "p1",
      church_id: "demo-church",
      full_name: "Ana Martins",
      phone_primary: "(11) 98821-4430",
      email: "ana@exemplo.org",
      address: { city: "São Paulo", state: "SP", country: "Brasil" },
      categories: ["Membro"],
      ministry_roles: [],
      group_ids: ["g1"],
      active: true,
      baptized: true,
      consent: { ...consentOff, messaging: true, data_processing: true },
    },
    {
      id: "p2",
      church_id: "demo-church",
      full_name: "Lucas Almeida",
      phone_primary: "(11) 99672-1208",
      address: { city: "São Paulo", state: "SP", country: "Brasil" },
      categories: ["Novo convertido"],
      ministry_roles: [],
      group_ids: ["g1", "g2"],
      active: true,
      baptized: false,
      consent: {
        ...consentOff,
        messaging: true,
        representatives_contact: true,
        data_processing: true,
      },
    },
    {
      id: "p3",
      church_id: "demo-church",
      full_name: "Clara Souza",
      phone_primary: "(11) 98440-7792",
      address: { city: "São Paulo", state: "SP", country: "Brasil" },
      categories: ["Membro"],
      ministry_roles: ["Diaconia"],
      group_ids: [],
      active: true,
      baptized: true,
      consent: { ...consentOff, data_processing: true },
    },
    {
      id: "p4",
      church_id: "demo-church",
      full_name: "Sofia Ribeiro",
      birth_date: "2018-05-12",
      address: { city: "São Paulo", state: "SP", country: "Brasil" },
      categories: ["Criança"],
      ministry_roles: [],
      group_ids: [],
      active: true,
      consent: { ...consentOff, data_processing: true },
    },
    {
      id: "p5",
      church_id: "demo-church",
      full_name: "Mariana Ribeiro",
      phone_primary: "(11) 99876-5421",
      email: "mariana@exemplo.org",
      address: { city: "São Paulo", state: "SP", country: "Brasil" },
      categories: ["Membro", "Responsável"],
      ministry_roles: [],
      group_ids: [],
      active: true,
      consent: { ...consentOff, messaging: true, data_processing: true },
    },
  ],
  groups: [
    {
      id: "g1",
      church_id: "demo-church",
      name: "Consolidação Essencial",
      track: "Consolidação",
      description: "Fundamentos para novos convertidos.",
      leader_id: "p1",
      weekday: 1,
      starts_at: "19:30",
      location: "Sala 03",
      capacity: 25,
      active: true,
      members: 2,
    },
    {
      id: "g2",
      church_id: "demo-church",
      name: "Primeiros Passos",
      track: "Integração",
      leader_id: "p3",
      weekday: 2,
      starts_at: "20:00",
      location: "Sala 02",
      capacity: 20,
      active: true,
      members: 1,
    },
  ],
  events: [
    {
      id: "e1",
      church_id: "demo-church",
      title: "Culto de celebração",
      starts_at: "2026-08-24T19:00:00-03:00",
      all_day: false,
      location: "Santuário",
      color: "green",
      event_type: "worship",
      image_consent_required: true,
    },
    {
      id: "e2",
      church_id: "demo-church",
      title: "Consolidação Essencial",
      starts_at: "2026-08-26T19:30:00-03:00",
      all_day: false,
      location: "Sala 03",
      color: "blue",
      event_type: "teaching",
      image_consent_required: false,
    },
  ],
  transactions: [
    {
      id: "t1",
      church_id: "demo-church",
      description: "Dízimos e ofertas",
      type: "income",
      status: "paid",
      amount: 8450,
      due_date: "2026-08-22",
      paid_at: "2026-08-22T10:00:00-03:00",
      account_id: "a1",
      category_id: "c1",
    },
    {
      id: "t2",
      church_id: "demo-church",
      description: "Aluguel do templo",
      type: "expense",
      status: "paid",
      amount: 3200,
      due_date: "2026-08-20",
      paid_at: "2026-08-20T10:00:00-03:00",
      account_id: "a1",
      category_id: "c2",
    },
  ],
  accounts: [
    {
      id: "a1",
      church_id: "demo-church",
      name: "Caixa principal",
      opening_balance: 12000,
      active: true,
    },
    {
      id: "a2",
      church_id: "demo-church",
      name: "Conta bancária",
      opening_balance: 24500,
      active: true,
    },
  ],
  categories: [
    {
      id: "c1",
      church_id: "demo-church",
      name: "Dízimos e ofertas",
      type: "income",
    },
    {
      id: "c2",
      church_id: "demo-church",
      name: "Manutenção e estrutura",
      type: "expense",
    },
  ],
  children: [
    {
      person_id: "p4",
      church_id: "demo-church",
      allergies: "Alergia a amendoim",
      emergency_contact_name: "Mariana Ribeiro",
      emergency_contact_phone: "(11) 99876-5421",
      authorized_pickup_people: [{ name: "Mariana Ribeiro" }],
      pickup_code_required: true,
      active: true,
    },
  ],
  guardians: [
    {
      id: "cg1",
      church_id: "demo-church",
      child_id: "p4",
      guardian_person_id: "p5",
      relationship: "Mãe",
      legal_guardian: true,
      primary_contact: true,
      can_pickup: true,
    },
  ],
  childAuthorizations: [
    {
      id: "ca1",
      church_id: "demo-church",
      event_id: "e1",
      child_id: "p4",
      guardian_id: "p5",
      decision: "pending",
      allow_photo: false,
      allow_video: false,
      allow_social_media: false,
      consent_version: "kids-image-v1",
      consent_text_snapshot:
        "Autorização específica para captação e uso de imagem da criança durante o Culto de celebração em 24/08/2026. A recusa não impede a participação da criança.",
      token: "11111111-1111-4111-8111-111111111111",
      generated_at: "2026-08-24T08:00:00-03:00",
    },
  ],
  childCheckins: [],
  departments: [
    {
      id: "d1",
      church_id: "demo-church",
      name: "Ministério de Louvor",
      department_type: "worship",
      description: "Adoração, música e escalas.",
      active: true,
    },
    {
      id: "d2",
      church_id: "demo-church",
      name: "Mídia e Comunicação",
      department_type: "media",
      description: "Comunicação, transmissão e redes sociais.",
      active: true,
    },
  ],
  departmentRoles: [
    {
      id: "dr1",
      church_id: "demo-church",
      department_id: "d1",
      title: "Líder",
      sort_order: 0,
    },
    {
      id: "dr2",
      church_id: "demo-church",
      department_id: "d1",
      title: "Músico(a)",
      sort_order: 1,
    },
  ],
  departmentMembers: [
    {
      church_id: "demo-church",
      department_id: "d1",
      person_id: "p1",
      role_id: "dr1",
      joined_at: "2026-01-10",
      active: true,
    },
  ],
  teachingMeetings: [
    {
      id: "tm1",
      church_id: "demo-church",
      group_id: "g1",
      title: "Encontro 1 — Nova vida",
      meeting_date: "2026-08-24T19:30:00-03:00",
      lesson: "Fundamentos da nova vida",
    },
  ],
  teachingAttendance: [
    {
      church_id: "demo-church",
      meeting_id: "tm1",
      person_id: "p1",
      status: "present",
    },
    {
      church_id: "demo-church",
      meeting_id: "tm1",
      person_id: "p2",
      status: "present",
    },
  ],
  groupHistory: [
    {
      id: "gh1",
      church_id: "demo-church",
      person_id: "p1",
      group_id: "g1",
      group_name: "Consolidação Essencial",
      role_title: "Líder",
      action: "joined",
      occurred_at: "2026-01-10T10:00:00-03:00",
    },
  ],
};

const storageKey = "comunhao-workspace-v2";

function localRead(): WorkspaceData {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return structuredClone(demoData);
  try {
    const parsed = JSON.parse(saved) as Partial<WorkspaceData>;
    return {
      ...structuredClone(demoData),
      ...parsed,
      accounts: parsed.accounts ?? structuredClone(demoData.accounts),
      categories: parsed.categories ?? structuredClone(demoData.categories),
      children: parsed.children ?? structuredClone(demoData.children),
      guardians: parsed.guardians ?? structuredClone(demoData.guardians),
      childAuthorizations:
        parsed.childAuthorizations ??
        structuredClone(demoData.childAuthorizations),
      childCheckins:
        parsed.childCheckins ?? structuredClone(demoData.childCheckins),
      departments: parsed.departments ?? structuredClone(demoData.departments),
      departmentRoles:
        parsed.departmentRoles ?? structuredClone(demoData.departmentRoles),
      departmentMembers:
        parsed.departmentMembers ?? structuredClone(demoData.departmentMembers),
      teachingMeetings:
        parsed.teachingMeetings ?? structuredClone(demoData.teachingMeetings),
      teachingAttendance:
        parsed.teachingAttendance ??
        structuredClone(demoData.teachingAttendance),
      groupHistory:
        parsed.groupHistory ?? structuredClone(demoData.groupHistory),
    };
  } catch {
    return structuredClone(demoData);
  }
}

function localWrite(data: WorkspaceData) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}
export function newId() {
  return crypto.randomUUID();
}
function ageFromIsoDate(value: string) {
  const birthDate = new Date(`${value}T12:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (
    today.getMonth() < birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() < birthDate.getDate())
  )
    age -= 1;
  return age;
}

export async function resolveWorkspace(
  userId: string,
  appRole?: string,
): Promise<{ role: Role; churchId: string | null; churchName: string }> {
  if (isDemoMode || !supabase)
    return {
      role: appRole === "master" ? "master" : "super",
      churchId: "demo-church",
      churchName: "Igreja da Promessa",
    };
  const master = appRole === "master";
  if (master) {
    return {
      role: "master",
      churchId: null,
      churchName: "Administração da plataforma",
    };
  }
  const { data, error } = await supabase
    .from("church_memberships")
    .select("church_id,role,churches(name)")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const joined = data?.churches as unknown as { name?: string } | null;
  return {
    role: (data?.role as Role) ?? "viewer",
    churchId: data?.church_id ?? null,
    churchName: joined?.name ?? "Nenhuma igreja",
  };
}

export async function loadWorkspace(
  churchId: string | null,
  master: boolean,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) return localRead();
  if (master) {
    const { data, error } = await supabase
      .from("churches")
      .select("*")
      .order("name");
    if (error) throw error;
    return {
      ...emptyWorkspace,
      churches: (data ?? []).map((church) => ({
        id: church.id,
        name: church.name,
        email: church.email ?? undefined,
        phone: church.phone ?? undefined,
        document: church.document ?? undefined,
        city: church.address?.city,
        state: church.address?.state,
        active: church.active,
      })),
    };
  }
  const churchQuery = master
    ? supabase.from("churches").select("*").order("name")
    : supabase
        .from("churches")
        .select("*")
        .eq("id", churchId ?? "");
  if (!churchId && !master)
    return {
      churches: [],
      people: [],
      groups: [],
      events: [],
      transactions: [],
      accounts: [],
      categories: [],
      children: [],
      guardians: [],
      childAuthorizations: [],
      childCheckins: [],
      departments: [],
      departmentRoles: [],
      departmentMembers: [],
      teachingMeetings: [],
      teachingAttendance: [],
      groupHistory: [],
    };
  const [
    churchesRes,
    peopleRes,
    groupsRes,
    eventsRes,
    transactionsRes,
    accountsRes,
    categoriesRes,
    childrenRes,
    guardiansRes,
    authorizationsRes,
    checkinsRes,
    departmentsRes,
    departmentRolesRes,
    departmentMembersRes,
    teachingMeetingsRes,
    teachingAttendanceRes,
    groupHistoryRes,
  ] = await Promise.all([
    churchQuery,
    supabase
      .from("people")
      .select(
        "*,people_consents(*),teaching_group_members(group_id,role_title)",
      )
      .eq("church_id", churchId ?? "")
      .order("full_name"),
    supabase
      .from("teaching_groups")
      .select("*,teaching_group_members(person_id)")
      .eq("church_id", churchId ?? "")
      .order("name"),
    supabase
      .from("events")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("starts_at"),
    supabase
      .from("financial_transactions")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("due_date", { ascending: false }),
    supabase
      .from("financial_accounts")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("name"),
    supabase
      .from("financial_categories")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("name"),
    supabase
      .from("child_profiles")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("created_at"),
    supabase
      .from("child_guardians")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("created_at"),
    supabase
      .from("child_service_authorizations")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("generated_at", { ascending: false }),
    supabase
      .from("child_checkins")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("checkin_at", { ascending: false }),
    supabase
      .from("departments")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("name"),
    supabase
      .from("department_roles")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("sort_order"),
    supabase
      .from("department_members")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("joined_at"),
    supabase
      .from("teaching_meetings")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("meeting_date", { ascending: false }),
    supabase
      .from("teaching_attendance")
      .select("*")
      .eq("church_id", churchId ?? ""),
    supabase
      .from("person_group_history")
      .select("*")
      .eq("church_id", churchId ?? "")
      .order("occurred_at", { ascending: false }),
  ]);
  const error =
    churchesRes.error ||
    peopleRes.error ||
    groupsRes.error ||
    eventsRes.error ||
    transactionsRes.error ||
    accountsRes.error ||
    categoriesRes.error ||
    childrenRes.error ||
    guardiansRes.error ||
    authorizationsRes.error ||
    checkinsRes.error ||
    departmentsRes.error ||
    departmentRolesRes.error ||
    departmentMembersRes.error ||
    teachingMeetingsRes.error ||
    teachingAttendanceRes.error ||
    groupHistoryRes.error;
  if (error) throw error;
  return {
    churches: (churchesRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email ?? undefined,
      phone: c.phone ?? undefined,
      document: c.document ?? undefined,
      city: c.address?.city,
      state: c.address?.state,
      active: c.active,
    })),
    people: (peopleRes.data ?? []).map((p) => {
      const { people_consents, teaching_group_members, ...record } = p;
      return {
        ...record,
        address: p.address ?? {},
        children_names: p.children_names ?? [],
        categories: p.categories ?? [],
        ministry_roles: p.ministry_roles ?? [],
        group_ids: (teaching_group_members ?? []).map(
          (membership: { group_id: string }) => membership.group_id,
        ),
        group_roles: Object.fromEntries(
          (teaching_group_members ?? []).map(
            (membership: { group_id: string; role_title?: string }) => [
              membership.group_id,
              membership.role_title ?? "Aluno(a)",
            ],
          ),
        ),
        consent: (Array.isArray(people_consents)
          ? people_consents[0]
          : people_consents) ?? { ...consentOff },
      };
    }) as Person[],
    groups: (groupsRes.data ?? []).map((group) => {
      const { teaching_group_members, ...record } = group;
      return { ...record, members: teaching_group_members?.length ?? 0 };
    }) as TeachingGroup[],
    events: (eventsRes.data ?? []) as ChurchEvent[],
    transactions: (transactionsRes.data ?? []).map((t) => ({
      ...t,
      amount: Number(t.amount),
    })) as FinanceEntry[],
    accounts: (accountsRes.data ?? []).map((account) => ({
      ...account,
      opening_balance: Number(account.opening_balance),
    })) as FinancialAccount[],
    categories: (categoriesRes.data ?? []) as FinancialCategory[],
    children: (childrenRes.data ?? []).map((child) => ({
      ...child,
      authorized_pickup_people: child.authorized_pickup_people ?? [],
    })) as ChildProfile[],
    guardians: (guardiansRes.data ?? []) as ChildGuardian[],
    childAuthorizations: (authorizationsRes.data ?? []) as ChildAuthorization[],
    childCheckins: (checkinsRes.data ?? []) as ChildCheckin[],
    departments: (departmentsRes.data ?? []) as Department[],
    departmentRoles: (departmentRolesRes.data ?? []) as DepartmentRole[],
    departmentMembers: (departmentMembersRes.data ?? []) as DepartmentMember[],
    teachingMeetings: (teachingMeetingsRes.data ?? []) as TeachingMeeting[],
    teachingAttendance: (teachingAttendanceRes.data ??
      []) as TeachingAttendance[],
    groupHistory: (groupHistoryRes.data ?? []) as GroupMembershipHistory[],
  };
}

export async function savePerson(
  data: WorkspaceData,
  person: Person,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      people: [...data.people.filter((p) => p.id !== person.id), person].sort(
        (a, b) => a.full_name.localeCompare(b.full_name),
      ),
    };
    localWrite(next);
    return next;
  }
  const { consent, group_ids, group_roles, ...record } = person;
  void group_roles;
  const { data: saved, error } = await supabase
    .from("people")
    .upsert(record)
    .select()
    .single();
  if (error) throw error;
  const { error: consentError } = await supabase
    .from("people_consents")
    .upsert({
      ...consent,
      person_id: saved.id,
      church_id: saved.church_id,
      consented_at: consent.data_processing ? new Date().toISOString() : null,
    });
  if (consentError) throw consentError;
  const { error: clearGroupsError } = await supabase
    .from("teaching_group_members")
    .delete()
    .eq("person_id", saved.id);
  if (clearGroupsError) throw clearGroupsError;
  if (group_ids.length) {
    const { error: groupError } = await supabase
      .from("teaching_group_members")
      .insert(group_ids.map((group_id) => ({ group_id, person_id: saved.id })));
    if (groupError) throw groupError;
  }
  return loadWorkspace(person.church_id, false);
}

export async function savePersonFamily(
  data: WorkspaceData,
  person: Person,
  familyChildren: FamilyChildInput[],
): Promise<WorkspaceData> {
  const parent: Person = {
    ...person,
    children_names: familyChildren.map((child) => child.full_name.trim()),
  };
  let next = await savePerson(data, parent);

  for (const child of familyChildren) {
    const childId = child.id ?? newId();
    const childAge = ageFromIsoDate(child.birth_date);
    const childCategories = childAge < 18 ? ["Criança"] : ["Pré-cadastro"];
    if (childAge >= 12 && childAge < 18)
      childCategories.push("Adolescente");
    const existingPerson = next.people.find((item) => item.id === childId);
    const childPerson: Person = {
      ...(existingPerson ?? {
        id: childId,
        church_id: parent.church_id,
        ministry_roles: [],
        group_ids: [],
        active: true,
        consent: {
          ...consentOff,
          data_processing: parent.consent.data_processing,
        },
      }),
      full_name: child.full_name.trim(),
      birth_date: child.birth_date,
      document_cpf: child.document_cpf.trim(),
      address: structuredClone(parent.address),
      categories: existingPerson?.categories.length
        ? existingPerson.categories
        : childCategories,
    };
    if (childAge >= 18) {
      next = await savePerson(next, childPerson);
    } else {
      const existingProfile = next.children.find(
        (profile) => profile.person_id === childId,
      );
      next = await saveChild(
        next,
        childPerson,
        {
          ...(existingProfile ?? {
            person_id: childId,
            church_id: parent.church_id,
            authorized_pickup_people: [],
            pickup_code_required: true,
            active: true,
          }),
          emergency_contact_name: parent.full_name,
          emergency_contact_phone: parent.phone_primary,
          authorized_pickup_people: [
            {
              name: parent.full_name,
              document: parent.document_cpf,
            },
          ],
        },
        parent.id,
        "Pai, mãe ou responsável",
      );
    }
  }

  return next;
}

export async function saveGroup(
  data: WorkspaceData,
  group: TeachingGroup,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const selectedMembers = group.member_ids ?? [],
      historyChanges: GroupMembershipHistory[] = data.people.flatMap(
        (person) => {
          const wasMember = person.group_ids.includes(group.id),
            isMember = selectedMembers.includes(person.id);
          if (wasMember === isMember) return [];
          return [
            {
              id: newId(),
              church_id: group.church_id,
              person_id: person.id,
              group_id: group.id,
              group_name: group.name,
              role_title: isMember
                ? person.id === group.leader_id
                  ? "Líder"
                  : (group.member_roles?.[person.id] ?? "Aluno(a)")
                : person.group_roles?.[group.id],
              action: isMember ? "joined" : "removed",
              occurred_at: new Date().toISOString(),
            } satisfies GroupMembershipHistory,
          ];
        },
      );
    const next = {
      ...data,
      groups: [
        ...data.groups.filter((g) => g.id !== group.id),
        { ...group, members: group.member_ids?.length ?? group.members ?? 0 },
      ],
      people: data.people.map((person) => ({
        ...person,
        group_ids: group.member_ids?.includes(person.id)
          ? [...new Set([...person.group_ids, group.id])]
          : person.group_ids.filter((id) => id !== group.id),
        group_roles: {
          ...(person.group_roles ?? {}),
          ...(group.member_ids?.includes(person.id)
            ? {
                [group.id]:
                  group.leader_id === person.id
                    ? "Líder"
                    : (group.member_roles?.[person.id] ?? "Aluno(a)"),
              }
            : {}),
        },
      })),
      groupHistory: [...historyChanges, ...data.groupHistory],
    };
    localWrite(next);
    return next;
  }
  const { members, member_ids, member_roles, ...record } = group;
  void members;
  const { error } = await supabase.rpc("save_teaching_group_team_v2", {
    target_group: record.id,
    target_church: record.church_id,
    group_name: record.name,
    group_track: record.track,
    group_description: record.description ?? "",
    group_leader: record.leader_id || null,
    group_weekday: record.weekday ?? null,
    group_starts_at: record.starts_at || null,
    group_location: record.location ?? "",
    group_capacity: record.capacity ?? null,
    member_assignments: (member_ids ?? []).map((person_id) => ({
      person_id,
      role_title:
        person_id === record.leader_id
          ? "Líder"
          : (member_roles?.[person_id] ?? "Aluno(a)"),
    })),
  });
  if (error) throw error;
  return loadWorkspace(group.church_id, false);
}

export async function saveEvent(
  data: WorkspaceData,
  event: ChurchEvent,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      events: [...data.events.filter((e) => e.id !== event.id), event],
    };
    localWrite(next);
    return event.event_type === "worship" && event.image_consent_required
      ? generateKidsAuthorizations(next, event.id)
      : next;
  }
  const { error } = await supabase.from("events").upsert(event);
  if (error) throw error;
  return loadWorkspace(event.church_id, false);
}

export async function saveTransaction(
  data: WorkspaceData,
  entry: FinanceEntry,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      transactions: [
        entry,
        ...data.transactions.filter((t) => t.id !== entry.id),
      ],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase.from("financial_transactions").upsert(entry);
  if (error) throw error;
  return loadWorkspace(entry.church_id, false);
}

export async function saveFinancialAccount(
  data: WorkspaceData,
  account: FinancialAccount,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      accounts: [
        ...data.accounts.filter((item) => item.id !== account.id),
        account,
      ],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase.from("financial_accounts").upsert(account);
  if (error) throw error;
  return loadWorkspace(account.church_id, false);
}

export async function saveFinancialCategory(
  data: WorkspaceData,
  category: FinancialCategory,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      categories: [
        ...data.categories.filter((item) => item.id !== category.id),
        category,
      ],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase
    .from("financial_categories")
    .upsert(category);
  if (error) throw error;
  return loadWorkspace(category.church_id, false);
}

export async function saveChurch(
  data: WorkspaceData,
  church: Church,
  manager: { fullName: string; email: string; password: string },
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      churches: [...data.churches.filter((c) => c.id !== church.id), church],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase.functions.invoke("create-church", {
    body: {
      church,
      manager: {
        fullName: manager.fullName.trim(),
        email: manager.email.trim().toLowerCase(),
        password: manager.password,
      },
    },
  });
  if (error) {
    let message = error.message;
    const context = (error as typeof error & { context?: Response }).context;
    if (context) {
      try {
        const body = (await context.clone().json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Mantém a mensagem original quando a função não devolve JSON.
      }
    }
    throw new Error(
      message.includes("Failed to send") || message.includes("not found")
        ? "A função create-church ainda não foi publicada no Supabase."
        : message,
    );
  }
  return loadWorkspace(null, true);
}

export async function saveChild(
  data: WorkspaceData,
  person: Person,
  profile: ChildProfile,
  guardianPersonId?: string,
  relationship = "Responsável legal",
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const guardian: ChildGuardian | null = guardianPersonId
      ? {
          id: newId(),
          church_id: profile.church_id,
          child_id: person.id,
          guardian_person_id: guardianPersonId,
          relationship,
          legal_guardian: true,
          primary_contact: true,
          can_pickup: true,
        }
      : null;
    const next: WorkspaceData = {
      ...data,
      people: [
        ...data.people.filter((item) => item.id !== person.id),
        person,
      ].sort((a, b) => a.full_name.localeCompare(b.full_name)),
      children: [
        ...data.children.filter((item) => item.person_id !== person.id),
        profile,
      ],
      guardians: guardian
        ? [
            ...data.guardians.filter((item) => item.child_id !== person.id),
            guardian,
          ]
        : data.guardians,
    };
    localWrite(next);
    return generateKidsAuthorizations(next, undefined);
  }
  await savePerson(data, person);
  const { error: profileError } = await supabase
    .from("child_profiles")
    .upsert(profile);
  if (profileError) throw profileError;
  if (guardianPersonId) {
    const { error: guardianError } = await supabase
      .from("child_guardians")
      .upsert(
        {
          church_id: profile.church_id,
          child_id: person.id,
          guardian_person_id: guardianPersonId,
          relationship,
          legal_guardian: true,
          primary_contact: true,
          can_pickup: true,
        },
        { onConflict: "child_id,guardian_person_id" },
      );
    if (guardianError) throw guardianError;
  }
  return loadWorkspace(profile.church_id, false);
}

export async function generateKidsAuthorizations(
  data: WorkspaceData,
  eventId?: string,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const targetEvents = data.events.filter(
      (event) =>
        (!eventId || event.id === eventId) &&
        event.event_type === "worship" &&
        event.image_consent_required,
    );
    const additions: ChildAuthorization[] = [];
    for (const event of targetEvents)
      for (const child of data.children.filter((item) => item.active)) {
        if (
          data.childAuthorizations.some(
            (item) =>
              item.event_id === event.id && item.child_id === child.person_id,
          )
        )
          continue;
        const guardian = data.guardians.find(
          (item) => item.child_id === child.person_id && item.legal_guardian,
        );
        additions.push({
          id: newId(),
          church_id: child.church_id,
          event_id: event.id,
          child_id: child.person_id,
          guardian_id: guardian?.guardian_person_id,
          decision: "pending",
          allow_photo: false,
          allow_video: false,
          allow_social_media: false,
          consent_version: "kids-image-v1",
          consent_text_snapshot: `Autorização específica para captação e uso de imagem da criança durante o evento “${event.title}”, em ${new Date(event.starts_at).toLocaleString("pt-BR")}. A recusa não impede a participação da criança.`,
          token: newId(),
          generated_at: new Date().toISOString(),
        });
      }
    const next = {
      ...data,
      childAuthorizations: [...data.childAuthorizations, ...additions],
    };
    localWrite(next);
    return next;
  }
  const targets = eventId
    ? [eventId]
    : data.events
        .filter(
          (event) =>
            event.event_type === "worship" && event.image_consent_required,
        )
        .map((event) => event.id);
  for (const id of targets) {
    const { error } = await supabase.rpc(
      "generate_kids_authorizations_for_event",
      { target_event: id },
    );
    if (error) throw error;
  }
  const targetChurchId =
    data.events.find((event) => event.id === eventId)?.church_id ??
    data.events.find((event) => targets.includes(event.id))?.church_id ??
    null;
  return loadWorkspace(targetChurchId, false);
}

export async function saveChildAuthorization(
  data: WorkspaceData,
  authorization: ChildAuthorization,
): Promise<WorkspaceData> {
  const updated = {
    ...authorization,
    signed_at: authorization.signed_at ?? new Date().toISOString(),
  };
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      childAuthorizations: data.childAuthorizations.map((item) =>
        item.id === updated.id ? updated : item,
      ),
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase
    .from("child_service_authorizations")
    .update({
      decision: updated.decision,
      allow_photo: updated.allow_photo,
      allow_video: updated.allow_video,
      allow_social_media: updated.allow_social_media,
      signed_name: updated.signed_name,
      signed_at: updated.signed_at,
      revoked_at:
        updated.decision === "revoked" ? new Date().toISOString() : null,
    })
    .eq("id", updated.id);
  if (error) throw error;
  return loadWorkspace(updated.church_id, false);
}

export async function checkInChild(
  data: WorkspaceData,
  checkin: ChildCheckin,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      childCheckins: [
        ...data.childCheckins.filter(
          (item) =>
            !(
              item.event_id === checkin.event_id &&
              item.child_id === checkin.child_id
            ),
        ),
        checkin,
      ],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase
    .from("child_checkins")
    .upsert(checkin, { onConflict: "event_id,child_id" });
  if (error) throw error;
  return loadWorkspace(checkin.church_id, false);
}

export async function checkOutChild(
  data: WorkspaceData,
  checkinId: string,
  pickupBy: string,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      childCheckins: data.childCheckins.map((item) =>
        item.id === checkinId
          ? {
              ...item,
              checkout_at: new Date().toISOString(),
              pickup_by: pickupBy,
            }
          : item,
      ),
    };
    localWrite(next);
    return next;
  }
  const checkin = data.childCheckins.find((item) => item.id === checkinId);
  if (!checkin) throw new Error("Check-in não encontrado.");
  const { error } = await supabase
    .from("child_checkins")
    .update({ checkout_at: new Date().toISOString(), pickup_by: pickupBy })
    .eq("id", checkinId);
  if (error) throw error;
  return loadWorkspace(checkin.church_id, false);
}

export async function loadPublicChildAuthorization(
  token: string,
): Promise<PublicChildAuthorization | null> {
  if (isDemoMode || !supabase) {
    const data = localRead(),
      authorization = data.childAuthorizations.find(
        (item) => item.token === token,
      );
    if (!authorization) return null;
    return {
      authorization_id: authorization.id,
      church_name:
        data.churches.find((item) => item.id === authorization.church_id)
          ?.name ?? "Igreja",
      event_title:
        data.events.find((item) => item.id === authorization.event_id)?.title ??
        "Culto",
      event_starts_at:
        data.events.find((item) => item.id === authorization.event_id)
          ?.starts_at ?? "",
      child_name:
        data.people.find((item) => item.id === authorization.child_id)
          ?.full_name ?? "Criança",
      decision: authorization.decision,
      allow_photo: authorization.allow_photo,
      allow_video: authorization.allow_video,
      allow_social_media: authorization.allow_social_media,
      consent_text: authorization.consent_text_snapshot,
      signed_name: authorization.signed_name,
      signed_at: authorization.signed_at,
    };
  }
  const { data, error } = await supabase
    .rpc("get_child_authorization_by_token", { auth_token: token })
    .maybeSingle();
  if (error) throw error;
  return data as PublicChildAuthorization | null;
}

export async function respondPublicChildAuthorization(
  token: string,
  response: {
    decision: "authorized" | "denied";
    photo: boolean;
    video: boolean;
    social: boolean;
    signedName: string;
  },
): Promise<void> {
  if (isDemoMode || !supabase) {
    const data = localRead(),
      authorization = data.childAuthorizations.find(
        (item) => item.token === token,
      );
    if (!authorization) throw new Error("Autorização não encontrada.");
    await saveChildAuthorization(data, {
      ...authorization,
      decision: response.decision,
      allow_photo: response.decision === "authorized" && response.photo,
      allow_video: response.decision === "authorized" && response.video,
      allow_social_media: response.decision === "authorized" && response.social,
      signed_name: response.signedName,
    });
    return;
  }
  const { error } = await supabase.rpc("respond_child_authorization", {
    auth_token: token,
    response_decision: response.decision,
    response_photo: response.photo,
    response_video: response.video,
    response_social_media: response.social,
    response_signed_name: response.signedName,
  });
  if (error) throw error;
}

const demoRegistrationToken = "22222222-2222-4222-8222-222222222222";

export async function getOrCreateChurchRegistrationLink(
  churchId: string,
): Promise<string> {
  if (isDemoMode || !supabase) return demoRegistrationToken;
  const { data, error } = await supabase.rpc(
    "get_or_create_church_registration_link",
    { target_church: churchId },
  );
  if (error) throw error;
  if (!data) throw new Error("Não foi possível gerar o link de cadastro.");
  return String(data);
}

export async function loadPublicChurchRegistration(
  token: string,
): Promise<PublicChurchRegistration | null> {
  if (isDemoMode || !supabase) {
    if (token !== demoRegistrationToken) return null;
    return {
      church_id: "demo-church",
      church_name: "Igreja da Promessa",
      active: true,
      expires_at: "2099-12-31T23:59:59Z",
    };
  }
  const { data, error } = await supabase.rpc(
    "get_church_registration_by_token",
    { registration_token: token },
  );
  if (error) throw error;
  const registration = Array.isArray(data) ? data[0] : data;
  return (registration as PublicChurchRegistration | undefined) ?? null;
}

export async function submitPublicChurchRegistration(
  token: string,
  input: SelfRegistrationInput,
): Promise<void> {
  if (isDemoMode || !supabase) {
    if (token !== demoRegistrationToken)
      throw new Error("Link de cadastro inválido ou expirado.");
    const data = localRead();
    const duplicate = data.people.some(
      (person) =>
        (input.email &&
          person.email?.toLowerCase() === input.email.toLowerCase()) ||
        (input.phone_primary &&
          person.phone_primary?.replace(/\D/g, "") ===
            input.phone_primary.replace(/\D/g, "")),
    );
    if (duplicate)
      throw new Error(
        "Já existe uma pessoa com este e-mail ou telefone nesta igreja.",
      );
    const parentId = newId();
    const normalizedCpfs = [
      input.document_cpf,
      ...input.children.map((child) => child.document_cpf),
    ].map((cpf) => cpf?.replace(/\D/g, ""));
    if (new Set(normalizedCpfs).size !== normalizedCpfs.length)
      throw new Error("O CPF do responsável e de cada criança deve ser único.");
    if (
      input.children.some((child) =>
        data.people.some(
          (person) =>
            person.church_id === "demo-church" &&
            person.document_cpf?.replace(/\D/g, "") ===
              child.document_cpf.replace(/\D/g, ""),
        ),
      )
    )
      throw new Error("Já existe uma pessoa com o CPF de uma das crianças.");

    data.people.push({
      id: parentId,
      church_id: "demo-church",
      full_name: input.full_name.trim(),
      birth_date: input.birth_date || undefined,
      gender: input.gender || undefined,
      education: input.education || undefined,
      marital_status: input.marital_status || undefined,
      spouse_name: input.spouse_name?.trim() || undefined,
      children_names: input.children.map((child) => child.full_name.trim()),
      document_cpf: input.document_cpf?.trim() || undefined,
      email: input.email?.trim().toLowerCase() || undefined,
      phone_primary: input.phone_primary?.trim() || undefined,
      phone_secondary: input.phone_secondary?.trim() || undefined,
      address: input.address,
      conversion_date: input.conversion_date || undefined,
      baptism_date: input.baptism_date || undefined,
      baptized: input.baptism_date ? true : undefined,
      categories: [...new Set(["Pré-cadastro", ...input.categories])],
      ministry_roles: [],
      group_ids: [],
      notes: "Cadastro realizado pelo link público da igreja.",
      active: true,
      consent: {
        ...consentOff,
        messaging: input.messaging_consent,
        data_processing: input.data_processing_consent,
      },
    });
    for (const child of input.children) {
      const childId = newId();
      const childAge = ageFromIsoDate(child.birth_date);
      const childCategories =
        childAge < 18 ? ["Pré-cadastro", "Criança"] : ["Pré-cadastro"];
      if (childAge >= 12 && childAge < 18)
        childCategories.push("Adolescente");
      data.people.push({
        id: childId,
        church_id: "demo-church",
        full_name: child.full_name.trim(),
        birth_date: child.birth_date,
        document_cpf: child.document_cpf.trim(),
        address: structuredClone(input.address),
        categories: childCategories,
        ministry_roles: [],
        group_ids: [],
        notes: "Cadastro criado junto com o responsável pelo link público.",
        active: true,
        consent: {
          ...consentOff,
          data_processing: input.data_processing_consent,
        },
      });
      if (childAge < 18) {
        data.children.push({
          person_id: childId,
          church_id: "demo-church",
          emergency_contact_name: input.full_name.trim(),
          emergency_contact_phone: input.phone_primary?.trim(),
          authorized_pickup_people: [
            {
              name: input.full_name.trim(),
              document: input.document_cpf?.trim(),
            },
          ],
          pickup_code_required: true,
          active: true,
        });
        data.guardians.push({
          id: newId(),
          church_id: "demo-church",
          child_id: childId,
          guardian_person_id: parentId,
          relationship: "Pai, mãe ou responsável",
          legal_guardian: true,
          primary_contact: true,
          can_pickup: true,
        });
      }
    }
    localWrite(data);
    return;
  }
  const { error } = await supabase.rpc("submit_church_self_registration", {
    registration_token: token,
    registration_data: input,
  });
  if (error) throw error;
}

export async function saveDepartment(
  data: WorkspaceData,
  department: Department,
  roles: string[],
  assignments: DepartmentAssignment[] = [],
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const createdRoles = roles.map((title, index) => ({
      id: newId(),
      church_id: department.church_id,
      department_id: department.id,
      title,
      sort_order: index,
    }));
    const next = {
      ...data,
      departments: [
        ...data.departments.filter((item) => item.id !== department.id),
        department,
      ],
      departmentRoles: [
        ...data.departmentRoles.filter(
          (item) => item.department_id !== department.id,
        ),
        ...createdRoles,
      ],
      departmentMembers: [
        ...data.departmentMembers.filter(
          (item) => item.department_id !== department.id,
        ),
        ...assignments.map((assignment) => ({
          church_id: department.church_id,
          department_id: department.id,
          person_id: assignment.person_id,
          role_id:
            createdRoles.find((role) => role.title === assignment.role_title)
              ?.id ?? createdRoles[0]?.id,
          joined_at: new Date().toISOString().slice(0, 10),
          active: true,
          can_manage: assignment.can_manage,
        })),
      ],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase.rpc("save_department_team", {
    target_department: department.id,
    target_church: department.church_id,
    department_name: department.name,
    department_type: department.department_type,
    department_description: department.description ?? "",
    role_titles: roles,
    member_assignments: assignments,
  });
  if (error) throw error;
  return loadWorkspace(department.church_id, false);
}

export async function deleteDepartment(
  data: WorkspaceData,
  department: Department,
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      departments: data.departments.filter((item) => item.id !== department.id),
      departmentRoles: data.departmentRoles.filter(
        (item) => item.department_id !== department.id,
      ),
      departmentMembers: data.departmentMembers.filter(
        (item) => item.department_id !== department.id,
      ),
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase
    .from("departments")
    .delete()
    .eq("id", department.id)
    .eq("church_id", department.church_id);
  if (error) {
    if (error.code === "42501" || error.message.includes("row-level security"))
      throw new Error(
        "Somente o Gestor Geral pode excluir departamentos desta igreja.",
      );
    throw error;
  }
  return loadWorkspace(department.church_id, false);
}

export async function saveTeachingMeeting(
  data: WorkspaceData,
  meeting: TeachingMeeting,
  attendance: TeachingAttendance[],
): Promise<WorkspaceData> {
  if (isDemoMode || !supabase) {
    const next = {
      ...data,
      teachingMeetings: [
        ...data.teachingMeetings.filter((item) => item.id !== meeting.id),
        meeting,
      ],
      teachingAttendance: [
        ...data.teachingAttendance.filter(
          (item) => item.meeting_id !== meeting.id,
        ),
        ...attendance,
      ],
    };
    localWrite(next);
    return next;
  }
  const { error } = await supabase.from("teaching_meetings").upsert(meeting);
  if (error) throw error;
  if (attendance.length) {
    const { error: attendanceError } = await supabase
      .from("teaching_attendance")
      .upsert(attendance, { onConflict: "meeting_id,person_id" });
    if (attendanceError) throw attendanceError;
  }
  return loadWorkspace(meeting.church_id, false);
}

export async function loadTeam(churchId: string): Promise<TeamMember[]> {
  if (isDemoMode || !supabase)
    return [
      {
        id: "m1",
        user_id: "demo-user",
        full_name: "Artur Silva",
        role: "super",
        active: true,
      },
      {
        id: "m2",
        user_id: "demo-people",
        full_name: "Márcia Alves",
        role: "people",
        active: true,
      },
      {
        id: "m3",
        user_id: "demo-finance",
        full_name: "Carlos Nunes",
        role: "finance",
        active: true,
      },
    ];
  const { data, error } = await supabase
    .from("church_memberships")
    .select("id,user_id,role,active,profiles(full_name)")
    .eq("church_id", churchId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((member) => ({
    id: member.id,
    user_id: member.user_id,
    role: member.role as Role,
    active: member.active,
    full_name:
      (member.profiles as unknown as { full_name?: string } | null)
        ?.full_name ?? "Usuário da equipe",
  }));
}

export async function inviteTeamMember(
  churchId: string,
  email: string,
  fullName: string,
  role: Role,
): Promise<void> {
  if (isDemoMode || !supabase) return;
  const { error } = await supabase.functions.invoke("invite-user", {
    body: { churchId, email, fullName, role },
  });
  if (error) throw error;
}

export const emptyConsent = consentOff;
export const emptyWorkspace: WorkspaceData = {
  churches: [],
  people: [],
  groups: [],
  events: [],
  transactions: [],
  accounts: [],
  categories: [],
  children: [],
  guardians: [],
  childAuthorizations: [],
  childCheckins: [],
  departments: [],
  departmentRoles: [],
  departmentMembers: [],
  teachingMeetings: [],
  teachingAttendance: [],
  groupHistory: [],
};
