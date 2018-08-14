#include <stdio.h>
#include <stdint.h>
#include <ctime>
#include <map>

#include "diff_adjust.h"


int main(){

	unsigned int diff = CalculateNextWorkRequired( 100, 100, 100, "0007ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff" );
	printf("diff = %d\n\n", diff);
	return 0;

}

