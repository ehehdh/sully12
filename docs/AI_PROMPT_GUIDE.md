# 🤖 AI 프롬프트 관리 가이드

> AI 중재자 프롬프트를 쉽게 수정하고 관리하는 방법

## 📁 프롬프트 파일 위치

```
src/config/prompts/
└── index.ts        # 모든 AI 프롬프트가 이 파일에 있습니다
```

---

## 🔧 프롬프트 수정 방법

### 1. 파일 열기

`src/config/prompts/index.ts` 파일을 열어주세요.

### 2. 프롬프트 찾기

파일 내에서 수정하려는 프롬프트를 찾습니다:

| 프롬프트 상수 | 용도 |
|--------------|------|
| `FALLACY_CHECK_PROMPT` | 논리적 오류 검사 |
| `FACT_CHECK_PROMPT` | 팩트 체크 |
| `TOXICITY_CHECK_PROMPT` | 독성 언어 검사 |
| `STAGE_INTRO_PROMPTS` | 토론 단계별 안내 메시지 |
| `OPPONENT_RESPONSE_PROMPT` | AI 상대방 응답 생성 |
| `VERDICT_PROMPT` | 최종 판정 생성 |

### 3. 내용 수정

`system` 필드의 내용을 수정합니다:

```typescript
export const FALLACY_CHECK_PROMPT: PromptTemplate = {
  version: "1.0.1",  // 👈 버전 업데이트
  lastUpdated: "2024-12-26",  // 👈 날짜 업데이트
  system: `
    // 여기에 수정된 프롬프트 내용을 작성합니다
  `
};
```

### 4. 버전 업데이트

수정 후 반드시 `version`과 `lastUpdated`를 업데이트하세요.

---

## 📝 프롬프트 작성 가이드라인

### 구조화된 프롬프트

```typescript
system: `당신은 [역할]입니다.

## 목표
[AI가 수행해야 할 작업]

## 분석 기준
1. **항목1**: 설명
2. **항목2**: 설명

## 응답 형식 (JSON)
{
  "field1": "type",
  "field2": "type"
}

## 규칙
- 규칙1
- 규칙2`
```

### 모범 사례

1. **명확한 역할 정의**: "당신은 ~입니다"로 시작
2. **구체적인 지시**: 모호한 표현 피하기
3. **예시 포함**: 원하는 응답의 예시 제공
4. **JSON 형식 명시**: 파싱 가능한 응답 유도
5. **제약 조건 명시**: 금지 사항 명확히

---

## 🛡️ 보안 고려사항

### 프롬프트 인젝션 방지

사용자 입력은 `injectVariables` 함수를 통해 삽입됩니다:

```typescript
import { injectVariables } from '@/config/prompts';

// 안전하게 사용자 입력 삽입
const safePrompt = injectVariables(prompt, {
  message: userInput,  // 자동으로 XML 태그로 래핑됨
  topic: topicName,
});
```

### 자동 이스케이프

`injectVariables` 함수는 다음을 수행합니다:

1. XML 특수문자 이스케이프 (`<`, `>`, `&` 등)
2. `<user_input>` 태그로 감싸기
3. 프롬프트 인젝션 시도 무력화

---

## 🔄 토론 단계별 메시지 수정

토론 진행 중 표시되는 안내 메시지를 수정하려면:

```typescript
export const STAGE_INTRO_PROMPTS: Record<string, string> = {
  opening_pro: `🎯 **찬성 측 입론 시간**

지금부터 3분간 찬성 측의 입론이 시작됩니다.
- 핵심 주장을 명확히 제시해주세요
- 근거와 함께 논리적으로 설명해주세요`,
  
  // ... 다른 단계들
};
```

### 이모지 가이드

| 단계 유형 | 추천 이모지 |
|----------|------------|
| 입론 | 🎯, 📢 |
| 교차조사 | ⚔️, 💬 |
| 반박 | 🛡️, 🔥 |
| 최종변론 | 🏁, ✨ |
| 판정 | 🤖, 🏆 |

---

## 📊 프롬프트 버전 확인

현재 사용 중인 프롬프트 버전을 확인하려면:

```typescript
import { getPromptVersions } from '@/config/prompts';

const versions = getPromptVersions();
console.log(versions);
// {
//   fallacyCheck: "1.0.0",
//   factCheck: "1.0.0",
//   toxicityCheck: "1.0.0",
//   opponentResponse: "1.0.0",
//   verdict: "1.0.0"
// }
```

---

## 🧪 프롬프트 테스트

수정한 프롬프트를 테스트하려면:

### 1. 개발 서버 실행

```bash
npm run dev
```

### 2. 토론 시작

실제 토론을 진행하며 AI 응답 확인

### 3. 콘솔 로그 확인

브라우저 개발자 도구에서 AI 응답 로그 확인

---

## ⚠️ 주의사항

1. **프로덕션 배포 전 테스트**: 프롬프트 변경은 AI 동작에 큰 영향
2. **버전 관리**: 변경 사항을 Git에 커밋하고 버전 기록
3. **롤백 준비**: 문제 발생 시 이전 버전으로 복원 가능하도록
4. **비용 고려**: 프롬프트가 길어지면 API 비용 증가

---

## 📚 추가 리소스

- [Groq API 문서](https://console.groq.com/docs)
- [프롬프트 엔지니어링 가이드](https://platform.openai.com/docs/guides/prompt-engineering)
- [Llama 3.1 모델 정보](https://ai.meta.com/llama/)

---

질문이 있으시면 이슈를 생성해주세요! 💬
