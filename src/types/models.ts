export type RoleCode = 'super_admin' | 'store_admin' | 'hod' | 'hr';

export type AuthUser = {
  userId: number;
  email: string;
  fullName: string;
  roleCode: RoleCode;
  roleName: string;
  storeId: number | null;
};

export type RecruitmentRequestRow = {
  RequestId: number;
  StoreAdminUserId: number;
  StoreId: number;
  JobTitle: string;
  Department: string | null;
  Description: string;
  Priority: string;
  RequiredCount: number;
  Deadline: string | null;
  WorkflowStatus: string;
  HodComment: string | null;
  HrNotes: string | null;
  ModifiedRequirements: string | null;
  ApprovedByHodUserId: number | null;
  HodActionAt: string | null;
  CreatedAt: string;
  UpdatedAt: string;
  StoreAdminName?: string;
  StoreName?: string;
};

export type TimelineEntry = {
  TimelineId: number;
  RequestId: number;
  UserId: number | null;
  ActionType: string;
  Comment: string | null;
  FromStatus: string | null;
  ToStatus: string | null;
  CreatedAt: string;
  UserName?: string | null;
  UserEmail?: string | null;
};

export type ManagedUser = {
  UserId: number;
  Email: string;
  FullName: string;
  StoreId: number | null;
  IsActive: boolean;
  CreatedAt: string;
  RoleCode: string;
  RoleName: string;
  StoreName?: string | null;
  hodStoreAdminIds: number[];
  hrStoreIds: number[];
};

export type StoreRow = {
  StoreId: number;
  Name: string;
  Code: string | null;
  IsActive: boolean;
};
