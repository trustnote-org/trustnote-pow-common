#ifndef __DIFF_ADJUST
#define __DIFF_ADJUST

#include <stdio.h>
#include <stdint.h>
#include <ctime>
#include <map>

#include "params.h"
#include "uint256.h"
#include "arith_uint256.h"

#ifdef __cplusplus 
extern "C" {
#endif

unsigned int CalculateNextWorkRequired(int64_t difficult,
                                        int64_t nActualTimespan,
                                        int64_t nStandardTimespan,
                                        const char* sPowLimit);

#ifdef __cplusplus 
}
#endif

#endif
