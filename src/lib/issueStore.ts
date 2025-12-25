// 관리자가 관리하는 이슈 저장소
// In production, this would be replaced with a database

export type Issue = {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: Date;
  isActive: boolean;
};

// Global store with HMR support
const globalForIssues = global as unknown as { issueStore: { issues: Issue[] } };

export const issueStore = globalForIssues.issueStore || {
  issues: [
    {
      id: "default-1",
      title: "기본소득제 도입",
      description: "모든 국민에게 조건 없이 일정 금액을 지급하는 기본소득제를 도입해야 하는가?",
      category: "경제",
      createdAt: new Date(),
      isActive: true,
    },
    {
      id: "default-2", 
      title: "사형제도 폐지",
      description: "대한민국의 사형제도를 완전히 폐지해야 하는가?",
      category: "법률",
      createdAt: new Date(),
      isActive: true,
    },
    {
      id: "default-3",
      title: "주 4일 근무제",
      description: "법정 근로시간을 줄여 주 4일 근무제를 도입해야 하는가?",
      category: "노동",
      createdAt: new Date(),
      isActive: true,
    },
  ]
};

if (process.env.NODE_ENV !== 'production') globalForIssues.issueStore = issueStore;

// 이슈 목록 조회 (활성화된 것만)
export const getActiveIssues = (): Issue[] => {
  return issueStore.issues.filter(issue => issue.isActive);
};

// 모든 이슈 조회 (관리자용)
export const getAllIssues = (): Issue[] => {
  return issueStore.issues;
};

// 이슈 추가
export const addIssue = (title: string, description: string, category: string): Issue => {
  const newIssue: Issue = {
    id: `issue-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    title,
    description,
    category,
    createdAt: new Date(),
    isActive: true,
  };
  
  issueStore.issues.push(newIssue);
  console.log(`[IssueStore] Added issue: ${title}`);
  return newIssue;
};

// 이슈 삭제
export const deleteIssue = (issueId: string): boolean => {
  const index = issueStore.issues.findIndex(i => i.id === issueId);
  if (index !== -1) {
    const deleted = issueStore.issues.splice(index, 1);
    console.log(`[IssueStore] Deleted issue: ${deleted[0].title}`);
    return true;
  }
  return false;
};

// 이슈 활성화/비활성화 토글
export const toggleIssue = (issueId: string): Issue | null => {
  const issue = issueStore.issues.find(i => i.id === issueId);
  if (issue) {
    issue.isActive = !issue.isActive;
    console.log(`[IssueStore] Toggled issue ${issue.title}: ${issue.isActive}`);
    return issue;
  }
  return null;
};

// 이슈 조회 (단일)
export const getIssueById = (issueId: string): Issue | null => {
  return issueStore.issues.find(i => i.id === issueId) || null;
};
