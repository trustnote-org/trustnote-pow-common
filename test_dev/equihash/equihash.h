#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <string.h>
#include <time.h>

#define CONTEXT_SIZE 178033152
#define ITERATIONS 10

#ifdef __cplusplus
extern "C" {
#endif

int equihash(uint8_t* input, uint32_t nonce, int nBits, const char* powLimit, int inputlen);

int checkProofOfWork(const char* hash, int nBits, const char* powLimit);

#ifdef __cplusplus
}
#endif
