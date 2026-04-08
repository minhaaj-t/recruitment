export type AppStackParamList = {
  Dashboard: undefined;
  CreateRequest: undefined;
  RequestDetail: { id: number };
  UserManagement: undefined;
  CreateUser: undefined;
};

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
} & AppStackParamList;
