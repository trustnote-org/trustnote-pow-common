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

uint32_t CalculateNextWorkRequired(uint32_t difficult,
                                        uint32_t nActualTimespan,
                                        uint32_t nStandardTimespan,
                                        const char* sPowLimit);

#ifdef __cplusplus 
}
#endif

#endif
